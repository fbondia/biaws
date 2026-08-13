# Contratos de configuração de monitoramento

Usar estes formatos ao chamar as ferramentas MCP. Omitir campos opcionais sem valor em vez de inventar defaults.

## Monitor ativo

Campos comuns:

```json
{
  "runtimeReference": "<id ou referência confirmada>",
  "name": "Saúde do serviço",
  "description": "Verifica o endpoint de saúde",
  "provider": "rest",
  "enabled": false,
  "intervalSeconds": 60,
  "timeoutSeconds": 10,
  "configuration": {},
  "templateRef": null
}
```

- `intervalSeconds`: inteiro entre 10 e 86400.
- `timeoutSeconds`: inteiro entre 1 e 300 e não superior ao intervalo.
- `templateRef`: `{ "id": "<templateId>", "version": "<version>" }`, somente para REST.

### Configuração REST

```json
{
  "method": "GET",
  "url": "https://service.example/actuator/health",
  "headers": { "Accept": "application/json" },
  "headerRefs": [
    { "name": "Authorization", "reference": "secret://service-auth" }
  ],
  "body": "",
  "followRedirects": false,
  "expectedStatuses": [200]
}
```

- Métodos: `GET`, `HEAD`, `POST`, `PUT`, `PATCH`, `DELETE`.
- URL: absoluta HTTP(S), sem usuário ou senha embutidos.
- `GET` e `HEAD` não aceitam body.
- Headers sensíveis como `Authorization`, `Cookie`, `Proxy-Authorization` e `X-API-Key` devem usar `headerRefs`.
- A resposta consumida por template deve ser JSON.

### Configuração Shell

```json
{
  "scriptId": "service-health",
  "arguments": ["--mode", "summary"],
  "environment": {},
  "failureStatus": "unavailable",
  "captureOutput": "none"
}
```

- `scriptId`: identificador da allowlist local, não caminho.
- `failureStatus`: `unknown`, `degraded` ou `unavailable`.
- `captureOutput`: `none`, `stdout`, `stderr` ou `both`.
- Não enviar `templateRef` para Shell.

## Template unificado

```json
{
  "schemaVersion": "1",
  "input": {
    "mediaType": "application/json",
    "sample": { "status": "UP", "latencyMs": 35 }
  },
  "transformation": {
    "language": "jsonata",
    "expression": "{\"status\": status = \"UP\" ? \"healthy\" : \"unavailable\", \"message\": \"Health \" & status, \"metadata\": {\"latency_ms\": latencyMs}}"
  },
  "output": {
    "status": {
      "type": "string",
      "required": true,
      "enum": ["healthy", "degraded", "unavailable", "unknown"]
    },
    "message": {
      "type": "string",
      "required": false,
      "maxLength": 2000
    },
    "metadata": {
      "type": "object",
      "required": true,
      "additionalProperties": false,
      "fields": [
        {
          "key": "latency_ms",
          "type": "number",
          "required": false,
          "minimum": 0
        }
      ]
    }
  },
  "presentation": {
    "label": "Saúde do serviço",
    "fields": [
      {
        "key": "latency_ms",
        "label": "Latência",
        "format": "number",
        "visualization": "value"
      }
    ],
    "series": []
  }
}
```

### Contrato de saída

- Status permitidos: estados de runtime suportados, exceto `archived`; normalmente `healthy`, `degraded`, `unavailable`, `unknown` e, quando semanticamente explícito, `stopped`.
- Tipos de metadado: `boolean`, `number`, `integer`, `string` e `array`.
- Arrays declaram `items` e aceitam no máximo 100 itens.
- Chaves sensíveis ou com nomes de credenciais são recusadas.
- A apresentação só pode referenciar campos declarados no contrato.

### Apresentação

- `format`: `status`, `percent`, `number`, `date` ou `text`.
- Campo: `visualization` igual a `badge`, `gauge` ou `value`.
- Série: `visualization` igual a `line`, com `xKey`, `xFormat`, `yKey` e `yFormatKey` declarados no contrato.

## Sequência das ferramentas

Template novo:

```text
monitoring_templates_preview
→ monitoring_templates_create
→ monitoring_templates_get
→ monitoring_templates_validate
→ monitoring_templates_activate (com autorização)
```

Monitor novo:

```text
runtime_active_monitors_list
→ runtime_active_monitors_create
→ runtime_active_monitors_list
→ runtime_active_monitors_update para habilitar (quando autorizado)
```

Atualização de template cria versão; nunca sobrescreve a anterior:

```text
monitoring_templates_get
→ monitoring_templates_preview
→ monitoring_templates_create_version
→ monitoring_templates_validate
→ monitoring_templates_activate (com autorização)
```
