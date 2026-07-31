#!/usr/bin/env node

import "../config.js";

import { ObjectId } from "mongodb";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { COLLECTION_NAMES } from "../database/collectionNames.js";
import { closeMongoClient, getMongoDatabase } from "../helpers/mongoClient.js";
import {
  createIssue,
  saveIssueClassification,
} from "../repositories/issuesRepository.js";
import { listOptionLists } from "../repositories/optionListsRepository.js";
import {
  createProcedure,
  createProcedureCollection,
} from "../repositories/proceduresRepository.js";
import {
  createRequest,
  createRequestTask,
} from "../repositories/requestsRepository.js";
import {
  getIssueTaxonomy,
  saveIssueTaxonomy,
} from "../repositories/taxonomyRepository.js";
import {
  createApplication,
  ensureDefaultWorkspace,
} from "../repositories/catalogRepository.js";
import { createComponent } from "../repositories/componentsRepository.js";

const SEED_ACTOR = "demo-seed";
const DEMO_ISSUE_ID = "DEMO-INC-001";
const DEMO_REQUEST_CODE = "DEMO-001";
const DEMO_PROCEDURE_TITLE = "Primeiros passos no workspace";
const DEMO_COLLECTION_NAME = "Demonstração";
const DEMO_APPLICATION_KEY = "bondia-workspaces-demo";
const DEMO_COMPONENT_KEY = "workspace-platform";

function dateLabel(offsetDays = 0) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

function monthLabel(offsetMonths = 0) {
  const date = new Date();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + offsetMonths);
  return date.toISOString().slice(0, 7);
}

async function ensureTaxonomy(query) {
  const current = await getIssueTaxonomy(query);
  if (current.taxonomy) return { created: false, taxonomy: current.taxonomy };

  const result = await saveIssueTaxonomy(
    {
      schemaVersion: 1,
      source: {
        kind: "demo-seed",
        description: "Catálogo inicial criado pelo bootstrap open source.",
      },
      tagGroups: [
        {
          id: "ambiente",
          label: "Ambiente",
          color: "#175cd3",
          tags: ["local", "homologacao", "producao"],
        },
        {
          id: "tratamento",
          label: "Tratamento",
          color: "#067647",
          tags: ["analise", "documentacao", "correcao"],
        },
      ],
      taxonomy: [
        {
          id: "operacao",
          label: "Operação",
          children: [
            { id: "acesso", label: "Acesso" },
            { id: "integracao", label: "Integração" },
          ],
        },
        {
          id: "produto",
          label: "Produto",
          children: [
            { id: "usabilidade", label: "Usabilidade" },
            { id: "automacao", label: "Automação" },
          ],
        },
      ],
      updatedBy: SEED_ACTOR,
    },
    query,
  );

  return { created: true, taxonomy: result.taxonomy };
}

async function ensureCatalog(db) {
  const actor = { userId: SEED_ACTOR };
  const workspace = await ensureDefaultWorkspace(actor);
  let application = await db.collection(COLLECTION_NAMES.APPLICATIONS).findOne({
    workspaceId: workspace.id,
    key: DEMO_APPLICATION_KEY,
  });
  if (!application) {
    application = await createApplication(
      workspace.id,
      {
        key: DEMO_APPLICATION_KEY,
        name: "Bondia Workspaces Demo",
        description: "Aplicação fictícia usada pelos dados de demonstração.",
        tags: ["demo"],
      },
      actor,
    );
  }
  let component = await db
    .collection(COLLECTION_NAMES.APPLICATION_COMPONENTS)
    .findOne({
      applicationId: application.id,
      key: DEMO_COMPONENT_KEY,
    });
  if (!component) {
    component = await createComponent(
      application.id,
      {
        key: DEMO_COMPONENT_KEY,
        name: "Plataforma de demonstração",
        description: "Componente fictício afetado pelos registros do seed.",
        type: "service",
        tags: ["demo"],
      },
      actor,
    );
  }
  return { workspace, application, component };
}

async function ensureIssue(db, context, query) {
  const existing = await db.collection(COLLECTION_NAMES.ISSUES).findOne({
    id: DEMO_ISSUE_ID,
    workspaceId: context.workspaceId,
  });
  let created = false;

  if (!existing) {
    await createIssue(
      {
        id: DEMO_ISSUE_ID,
        type: "incident",
        status: "open",
        title: "Falha intermitente na integração de demonstração",
        text: "Registro fictício para explorar filtros, classificação e histórico do workspace.",
        comment:
          "A análise inicial indica que a ocorrência está restrita ao ambiente local.",
        date: dateLabel(-2),
        createdBy: SEED_ACTOR,
        source: { kind: "demo-seed" },
        ...context,
      },
      query,
    );
    created = true;
  } else {
    await db
      .collection(COLLECTION_NAMES.ISSUES)
      .updateOne(
        { id: DEMO_ISSUE_ID, workspaceId: context.workspaceId },
        { $set: { ...context, updatedAt: new Date(), updatedBy: SEED_ACTOR } },
      );
  }

  await saveIssueClassification(
    DEMO_ISSUE_ID,
    {
      primaryTaxonomyId: "integracao",
      secondaryTaxonomyIds: ["automacao"],
      summary: "Exemplo de issue classificada para a experiência inicial.",
      tags: {
        ambiente: ["local"],
        tratamento: ["analise"],
      },
      updatedBy: SEED_ACTOR,
    },
    query,
  );

  return { created, id: DEMO_ISSUE_ID };
}

async function ensureRequest(db, context, query) {
  const existing = await db.collection(COLLECTION_NAMES.REQUESTS).findOne({
    clientCode: DEMO_REQUEST_CODE,
    workspaceId: context.workspaceId,
  });
  let requestId;
  let created = false;

  if (existing) {
    requestId = existing._id.toString();
    await db
      .collection(COLLECTION_NAMES.REQUESTS)
      .updateOne(
        { _id: existing._id },
        { $set: { ...context, updatedAt: new Date(), updatedBy: SEED_ACTOR } },
      );
  } else {
    const result = await createRequest(
      {
        clientCode: DEMO_REQUEST_CODE,
        title: "Evoluir onboarding do workspace",
        status: "Desenvolvimento",
        estimatedDeliveryDate: dateLabel(20),
        startDate: dateLabel(-10),
        endDate: dateLabel(20),
        estimatedJourneys: 12,
        description:
          "Melhoria fictícia que demonstra planejamento, checklist, jornadas e tarefas.",
        checklist: [
          {
            label: "Solicitação",
            done: true,
            date: dateLabel(-12),
            comment: "Necessidade registrada.",
          },
          {
            label: "Especificação Técnica",
            done: true,
            date: dateLabel(-10),
            comment: "Escopo inicial aprovado.",
          },
        ],
        journeys: [
          {
            month: monthLabel(0),
            plannedJourneys: 8,
            executedJourneys: 4,
            comment: "Primeira etapa.",
          },
          {
            month: monthLabel(1),
            plannedJourneys: 4,
            executedJourneys: 0,
            comment: "Conclusão prevista.",
          },
        ],
        specification: {
          sections: [
            {
              id: "objective",
              title: "Objetivo",
              content:
                "Reduzir o tempo entre a instalação e a primeira navegação útil.",
              order: 0,
            },
            {
              id: "scope",
              title: "Escopo de Atuação",
              content:
                "Compose, bootstrap seguro, dados fictícios e documentação de início rápido.",
              order: 1,
            },
          ],
        },
        notes: [
          {
            date: dateLabel(-10),
            content: "Seed criado exclusivamente com dados fictícios.",
          },
        ],
        createdBy: SEED_ACTOR,
        ...context,
      },
      query,
    );
    requestId = result.request.id;
    created = true;
  }

  const task = await db.collection(COLLECTION_NAMES.REQUEST_TASKS).findOne({
    requestId: new ObjectId(requestId),
    code: "DEMO-TASK-001",
  });
  if (!task) {
    await createRequestTask(
      requestId,
      {
        code: "DEMO-TASK-001",
        title: "Validar o ambiente local",
        status: "Andamento",
        startDate: dateLabel(-1),
        endDate: dateLabel(2),
        situation:
          "Executar o fluxo de bootstrap e revisar as telas principais.",
        description: "Confirmar API, UI, autenticação e dados de demonstração.",
        specification:
          "Registrar qualquer divergência encontrada durante a validação.",
      },
      query,
    );
  }

  return { created, taskCreated: !task, id: requestId };
}

async function ensureProcedure(db, context, query) {
  let collection = await db
    .collection(COLLECTION_NAMES.PROCEDURE_COLLECTIONS)
    .findOne({
      workspaceId: context.workspaceId,
      nameKey: DEMO_COLLECTION_NAME.toLocaleLowerCase("pt-BR"),
      parentId: "",
    });

  if (!collection) {
    const result = await createProcedureCollection(
      {
        name: DEMO_COLLECTION_NAME,
        createdBy: SEED_ACTOR,
      },
      query,
    );
    collection = result.collection;
  }

  const existing = await db.collection(COLLECTION_NAMES.PROCEDURES).findOne({
    title: DEMO_PROCEDURE_TITLE,
    workspaceId: context.workspaceId,
  });
  if (existing) {
    await db
      .collection(COLLECTION_NAMES.PROCEDURES)
      .updateOne(
        { id: existing.id, workspaceId: context.workspaceId },
        { $set: { ...context, updatedAt: new Date(), updatedBy: SEED_ACTOR } },
      );
    return { created: false, id: existing.id };
  }

  const result = await createProcedure(
    {
      title: DEMO_PROCEDURE_TITLE,
      summary: "Como iniciar o ambiente e explorar os dados fictícios.",
      procedure: [
        "# Primeiros passos",
        "",
        "1. Acesse a UI em `http://localhost:4400`.",
        "2. Entre com a credencial criada pelo bootstrap.",
        "3. Explore Chamados, Melhorias e Procedimentos.",
        "4. Crie uma chave de API na área da conta para usar MCP e CLI.",
        "",
        "> Todos os registros deste seed são fictícios e podem ser removidos.",
      ].join("\n"),
      collectionId: collection.id,
      classification: {
        primaryTaxonomyId: "operacao",
        secondaryTaxonomyIds: ["acesso"],
        tags: {
          ambiente: ["local"],
          tratamento: ["documentacao"],
        },
      },
      createdBy: SEED_ACTOR,
      ...context,
    },
    query,
  );

  return { created: true, id: result.procedure.id };
}

export async function seedDemoData() {
  const db = await getMongoDatabase();
  const catalog = await ensureCatalog(db);
  const query = { workspaceId: catalog.workspace.id };
  const optionLists = await listOptionLists(query);
  const taxonomy = await ensureTaxonomy(query);
  const context = {
    workspaceId: catalog.workspace.id,
    applicationId: catalog.application.id,
    affectedComponentIds: [catalog.component.id],
  };
  const [issue, request, procedure] = await Promise.all([
    ensureIssue(db, context, query),
    ensureRequest(db, context, query),
    ensureProcedure(db, context, query),
  ]);

  return {
    database: db.databaseName,
    optionLists: optionLists.items.length,
    taxonomyCreated: taxonomy.created,
    catalog: {
      workspaceId: catalog.workspace.id,
      applicationId: catalog.application.id,
      componentId: catalog.component.id,
    },
    issue,
    request,
    procedure,
  };
}

const isMain =
  Boolean(process.argv[1]) &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isMain) {
  seedDemoData()
    .then((result) => console.log(JSON.stringify(result, null, 2)))
    .catch((error) => {
      console.error(error?.stack || error);
      process.exitCode = 1;
    })
    .finally(closeMongoClient);
}
