import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";

import react from "@vitejs/plugin-react";
import { JSDOM } from "jsdom";
import { build } from "vite";

test("journey calendar filters and shows group totals only while collapsed", async () => {
  const outputDirectory = await mkdtemp(join(tmpdir(), "biaws-journey-calendar-"));
  const dom = new JSDOM("<!doctype html><div id=app></div>", {
    url: "https://biaws.example.test",
  });
  const previous = Object.fromEntries(
    ["document", "navigator", "window", "IS_REACT_ACT_ENVIRONMENT"].map((name) => [
      name,
      Object.getOwnPropertyDescriptor(globalThis, name),
    ]),
  );
  Object.defineProperties(globalThis, {
    document: { configurable: true, value: dom.window.document },
    navigator: { configurable: true, value: dom.window.navigator },
    window: { configurable: true, value: dom.window },
    IS_REACT_ACT_ENVIRONMENT: { configurable: true, value: true },
  });
  let harness;

  try {
    await build({
      configFile: false,
      logLevel: "silent",
      plugins: [react()],
      build: {
        lib: {
          entry: join(process.cwd(), "test/fixtures/JourneyCalendarHarness.jsx"),
          fileName: "journey-calendar-harness",
          formats: ["es"],
        },
        outDir: outputDirectory,
      },
    });
    const { mountJourneyCalendar, mountJourneyBalanceExamples } = await import(
      pathToFileURL(join(outputDirectory, "journey-calendar-harness.js"))
    );
    let selectedRequest;
    harness = await mountJourneyCalendar(document.getElementById("app"), (id) => {
      selectedRequest = id;
    });
    const [before, after] = document.querySelectorAll('input[type="number"]');
    const balance = document.querySelector('input[type="checkbox"]');
    const clear = [...document.querySelectorAll("button")].find((button) => button.textContent === "Limpar filtros");
    const summary = () => document.querySelector(".requestJourneyCalendarSummary > span").textContent;
    const titles = () =>
      [...document.querySelectorAll(".requestBillingMatrixDemand")].map((button) => button.textContent);
    const buttonNamed = (name) =>
      [...document.querySelectorAll("button")].find((button) => button.textContent === name);
    const groupNamed = (name) =>
      [...document.querySelectorAll(".requestBillingMatrixCollection")].find(
        (button) => button.querySelector("strong").textContent === name,
      );
    const groupValues = (name) => {
      const values = [];
      let cell = groupNamed(name).nextElementSibling;
      while (cell?.classList.contains("requestBillingMatrixCell")) {
        values.push(cell.textContent);
        cell = cell.nextElementSibling;
      }
      return values;
    };
    const assertExpandedGroupsEmpty = () => {
      for (const group of document.querySelectorAll('.requestBillingMatrixCollection[aria-expanded="true"]')) {
        assert.ok(groupValues(group.querySelector("strong").textContent).every((value) => value === ""));
      }
    };

    assert.equal(clear.disabled, true);
    assert.match(summary(), /3 melhorias · 3 meses · 17 previstas · 5 executadas/u);
    assert.match(before.closest("label").textContent, /Meses para trás/u);
    assert.match(after.closest("label").textContent, /Meses para frente/u);
    assertExpandedGroupsEmpty();
    assert.ok(document.querySelector(".requestBillingMatrixDemand + .requestBillingMatrixCell").textContent);

    await harness.click(groupNamed("API"));
    assert.deepEqual(groupValues("API"), ["0 / 8", "2 / 2", "-", "2 / 10"]);
    assert.deepEqual(titles(), ["Melhoria balanceada", "Melhoria futura"]);
    assertExpandedGroupsEmpty();

    await harness.click(groupNamed("Plataforma"));
    assert.deepEqual(groupValues("Plataforma"), ["0 / 8", "5 / 5", "-", "5 / 13"]);
    assert.equal(groupNamed("API"), undefined);
    assert.deepEqual(titles(), ["Melhoria futura"]);
    assertExpandedGroupsEmpty();

    await harness.click(groupNamed("Plataforma"));
    assert.equal(groupNamed("API").getAttribute("aria-expanded"), "false");
    assert.equal(groupValues("API")[3], "2 / 10");
    assertExpandedGroupsEmpty();
    await harness.click(buttonNamed("Expandir tudo"));
    assert.equal(titles().length, 3);
    assertExpandedGroupsEmpty();

    await harness.click(buttonNamed("Contrair tudo"));
    assert.equal(document.querySelectorAll(".requestBillingMatrixCollection").length, 1);
    assert.deepEqual(titles(), []);
    assert.deepEqual(groupValues("Total geral"), ["0 / 8", "5 / 5", "0 / 4", "5 / 17"]);
    await harness.click(groupNamed("Total geral"));
    assert.equal(groupValues("Raiz")[3], "0 / 4");
    assert.equal(groupValues("Plataforma")[3], "5 / 13");
    assertExpandedGroupsEmpty();
    await harness.click(buttonNamed("Expandir tudo"));
    assertExpandedGroupsEmpty();

    await harness.setNumber(before, "0");
    await harness.setNumber(after, "0");
    assert.match(summary(), /2 melhorias · 1 mês · 5 previstas · 5 executadas/u);
    assert.deepEqual(titles(), ["Melhoria pendente", "Melhoria balanceada"]);
    assert.equal(document.querySelectorAll(".requestBillingMatrixHeader").length, 3);

    await harness.click(balance);
    assert.deepEqual(titles(), ["Melhoria pendente"]);
    assert.match(summary(), /1 melhoria · 1 mês · 2 previstas · 2 executadas/u);
    await harness.click(document.querySelector(".requestBillingMatrixDemand"));
    assert.equal(selectedRequest, "pending");
    await harness.click(document.querySelector(".requestBillingMatrixCollection"));
    assert.deepEqual(titles(), []);
    assert.deepEqual(groupValues("Total geral"), ["2 / 2", "2 / 2"]);
    await harness.click(
      [...document.querySelectorAll("button")].find((button) => button.textContent === "Expandir tudo"),
    );
    assert.deepEqual(titles(), ["Melhoria pendente"]);
    assertExpandedGroupsEmpty();

    await harness.click(clear);
    assert.equal(before.value, "");
    assert.equal(after.value, "");
    assert.equal(balance.checked, false);
    assert.equal(clear.disabled, true);
    assert.equal(titles().length, 3);

    await harness.setNumber(before, "1");
    await harness.click(balance);
    await harness.setNumber(after, "0");
    assert.deepEqual(titles(), ["Melhoria pendente"]);
    await harness.click(clear);
    assert.equal(titles().length, 3);

    await harness.unmount();
    harness = await mountJourneyBalanceExamples(document.getElementById("app"));
    const bars = [...document.querySelectorAll('[role="img"]')];
    assert.equal(bars.length, 5);
    assert.deepEqual(
      bars.map((bar) => bar.textContent),
      ["5 / 8", "5 / 3", "0 / 4", "4 / 0", "5 / 5"],
    );
    assert.match(bars[0].getAttribute("aria-label"), /5 previstas e executadas; 3 previstas pendentes/u);
    assert.match(bars[1].getAttribute("aria-label"), /2 executadas além do previsto/u);
    assert.equal(bars[0].title, bars[0].getAttribute("aria-label"));
    assert.equal(bars[0].querySelector(".requestJourneyBalanceBalanced").style.width, "62.5%");
    assert.equal(bars[0].querySelector(".requestJourneyBalancePending").style.width, "37.5%");
    assert.equal(bars[1].querySelector(".requestJourneyBalanceBalanced").style.width, "60%");
    assert.equal(bars[1].querySelector(".requestJourneyBalanceExcess").style.width, "40%");
    assert.equal(bars[4].querySelectorAll(".requestJourneyBalanceSegment").length, 1);
    assert.equal(bars[4].querySelector(".requestJourneyBalanceBalanced").style.width, "100%");
    assert.equal(document.querySelector(".requestBillingMatrixEmpty").textContent, "-");
  } finally {
    if (harness) await harness.unmount();
    for (const [name, descriptor] of Object.entries(previous)) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete globalThis[name];
    }
    dom.window.close();
    await rm(outputDirectory, { force: true, recursive: true });
  }
});
