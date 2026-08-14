import { abortableSleep, retryWithBackoff } from "./retry.js";
import { normalizeProviderResult, providerFailureResult } from "./providers.js";
import { runWithSignal, timeoutSignal } from "./executionControl.js";

function executionLogContext(monitor) {
  return Object.fromEntries(
    Object.entries({
      workspaceId: monitor.workspaceId,
      applicationId: monitor.applicationId,
      componentId: monitor.componentId,
      deploymentId: monitor.deploymentId,
      runtimeId: monitor.runtimeId,
      monitorId: monitor.id,
      monitorName: monitor.name,
      executionId: monitor.executionId,
      provider: monitor.provider,
      trigger: monitor.trigger,
      scheduledFor: monitor.scheduledFor,
    }).filter(([, value]) => value !== undefined && value !== null),
  );
}

export class ExecutorEngine {
  #activeJobs = new Set();
  #jobControllers = new Set();
  #loopController = new AbortController();
  #lastSuccessfulPollAt = null;
  #running = false;
  #stopping = false;

  constructor({
    api,
    providers,
    config,
    telemetry,
    logger,
    now = () => new Date(),
    sleep = abortableSleep,
  }) {
    this.api = api;
    this.providers = providers;
    this.config = config;
    this.telemetry = telemetry;
    this.logger = logger;
    this.now = now;
    this.sleep = sleep;
  }

  status() {
    const age = this.#lastSuccessfulPollAt
      ? this.now().getTime() - this.#lastSuccessfulPollAt.getTime()
      : Infinity;
    return {
      enabled: this.config.enabled,
      running: this.#running,
      stopping: this.#stopping,
      activeExecutions: this.#activeJobs.size,
      lastSuccessfulPollAt: this.#lastSuccessfulPollAt?.toISOString() || null,
      live: this.#running && !this.#stopping,
      ready:
        this.#running &&
        !this.#stopping &&
        (!this.config.enabled || age <= this.config.readinessMaxAgeMs),
    };
  }

  async start() {
    if (this.#running) throw new Error("Executor engine is already running");
    this.#running = true;
    this.logger.info("executor_started", {
      executorId: this.config.executorId,
      enabled: this.config.enabled,
      concurrency: this.config.concurrency,
    });
    while (!this.#loopController.signal.aborted) {
      try {
        await this.pollOnce({ waitForJobs: false });
      } catch (error) {
        if (!this.#loopController.signal.aborted) {
          this.telemetry.increment("poll_failures");
          this.logger.error("executor_poll_failed", { error });
        }
      }
      try {
        await this.sleep(
          this.config.pollIntervalMs,
          this.#loopController.signal,
        );
      } catch {
        break;
      }
    }
  }

  async #withApiRetry(operation, context, signal) {
    return retryWithBackoff(operation, {
      attempts: this.config.retryAttempts,
      baseMs: this.config.retryBaseMs,
      maxMs: this.config.retryMaxMs,
      signal,
      sleep: this.sleep,
      shouldRetry: (error) => error?.retryable === true,
      onRetry: ({ attempt, delayMs, error }) => {
        this.telemetry.increment("api_retries");
        this.logger.warn("executor_api_retry", {
          operation: context,
          attempt,
          delayMs,
          code: error?.code,
          statusCode: error?.statusCode,
        });
      },
    });
  }

  async pollOnce({ waitForJobs = true } = {}) {
    if (!this.config.enabled || this.#stopping) return [];
    const available = this.config.concurrency - this.#activeJobs.size;
    if (available <= 0) return [];
    this.telemetry.increment("polls");
    const response = await this.#withApiRetry(
      () =>
        this.api.acquire(
          {
            executorId: this.config.executorId,
            limit: available,
            leaseSeconds: this.config.leaseSeconds,
          },
          { signal: this.#loopController.signal },
        ),
      "acquire",
      this.#loopController.signal,
    );
    this.#lastSuccessfulPollAt = this.now();
    this.telemetry.gauge(
      "last_successful_poll_timestamp_seconds",
      this.#lastSuccessfulPollAt.getTime() / 1_000,
    );
    const items = Array.isArray(response?.items) ? response.items : [];
    this.telemetry.increment("leases_acquired", items.length);
    const jobs = items.map((monitor) => this.#trackJob(monitor));
    if (waitForJobs) await Promise.allSettled(jobs);
    return items;
  }

  #trackJob(monitor) {
    const job = this.#executeMonitor(monitor);
    this.#activeJobs.add(job);
    this.telemetry.gauge("active_executions", this.#activeJobs.size);
    const cleanup = () => {
      this.#activeJobs.delete(job);
      this.telemetry.gauge("active_executions", this.#activeJobs.size);
    };
    job.then(cleanup, cleanup);
    return job;
  }

  async #renewLease(monitor, controller, finished) {
    while (!finished.value && !controller.signal.aborted) {
      try {
        await this.sleep(this.config.renewIntervalMs, controller.signal);
      } catch {
        break;
      }
      if (finished.value || controller.signal.aborted) break;
      try {
        await this.#withApiRetry(
          () =>
            this.api.renew(
              monitor.leaseToken,
              {
                executorId: this.config.executorId,
                leaseSeconds: this.config.leaseSeconds,
              },
              { signal: controller.signal },
            ),
          "renew",
          controller.signal,
        );
        this.telemetry.increment("leases_renewed");
      } catch (error) {
        if (!controller.signal.aborted) {
          this.telemetry.increment("lease_losses");
          this.logger.warn("executor_lease_lost", {
            ...executionLogContext(monitor),
            code: error?.code,
          });
          controller.abort(error);
        }
      }
    }
  }

  async #executeMonitor(monitor) {
    const startedAt = this.now();
    const logContext = executionLogContext(monitor);
    this.logger.info("executor_execution_started", logContext);
    const scheduledAt = new Date(monitor.scheduledFor);
    if (Number.isFinite(scheduledAt.getTime())) {
      this.telemetry.observe(
        "schedule_lag_seconds",
        Math.max(0, (startedAt.getTime() - scheduledAt.getTime()) / 1_000),
      );
    }
    const leaseController = new AbortController();
    const providerTimeout = timeoutSignal(
      Number(monitor.timeoutSeconds) * 1_000,
    );
    const providerSignal = AbortSignal.any([
      leaseController.signal,
      providerTimeout.controller.signal,
    ]);
    this.#jobControllers.add(leaseController);
    const finished = { value: false };
    const heartbeat = this.#renewLease(monitor, leaseController, finished);
    try {
      let result;
      try {
        const providerResult = await runWithSignal(
          this.providers.execute(monitor, { signal: providerSignal }),
          providerSignal,
        );
        result = normalizeProviderResult(providerResult, monitor, this.now());
      } catch (error) {
        if (leaseController.signal.aborted) {
          this.telemetry.increment("execution_failures");
          return;
        }
        this.telemetry.increment("provider_failures");
        result = providerFailureResult(error, monitor, this.now());
        this.logger.warn("executor_provider_failed", {
          ...logContext,
          code: error?.code,
        });
      }
      try {
        await this.#withApiRetry(
          () =>
            this.api.publish(
              monitor.leaseToken,
              { executorId: this.config.executorId, ...result },
              { signal: leaseController.signal },
            ),
          "publish",
          leaseController.signal,
        );
        this.telemetry.increment("executions_completed");
        this.logger.info("executor_execution_completed", {
          ...logContext,
          status: result.status,
          durationMs: Math.max(0, this.now().getTime() - startedAt.getTime()),
        });
      } catch (error) {
        this.telemetry.increment("execution_failures");
        this.logger.error("executor_execution_failed", {
          ...logContext,
          code: error?.code,
          durationMs: Math.max(0, this.now().getTime() - startedAt.getTime()),
        });
      }
    } finally {
      finished.value = true;
      providerTimeout.clear();
      providerTimeout.controller.abort(new Error("Execution completed"));
      leaseController.abort(new Error("Execution completed"));
      this.#jobControllers.delete(leaseController);
      await heartbeat;
      this.telemetry.observe(
        "execution_duration_seconds",
        Math.max(0, (this.now().getTime() - startedAt.getTime()) / 1_000),
      );
    }
  }

  async stop() {
    if (this.#stopping) return;
    this.#stopping = true;
    this.#loopController.abort(new Error("Executor is stopping"));
    const active = Promise.allSettled([...this.#activeJobs]);
    let graceTimer;
    const grace = new Promise((resolve) => {
      graceTimer = setTimeout(resolve, this.config.shutdownGraceMs);
      graceTimer.unref?.();
    });
    const result = await Promise.race([
      active.then(() => "complete"),
      grace.then(() => "timeout"),
    ]);
    clearTimeout(graceTimer);
    if (result === "timeout") {
      for (const controller of this.#jobControllers) {
        controller.abort(new Error("Executor shutdown grace period elapsed"));
      }
      await Promise.allSettled([...this.#activeJobs]);
    }
    this.#running = false;
    this.logger.info("executor_stopped", { graceful: result === "complete" });
  }
}
