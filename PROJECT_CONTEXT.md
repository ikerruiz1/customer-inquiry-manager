# MASTER CONTEXT & ARCHITECTURE SPECIFICATION
## Proyecto: Customer Inquiry Manager (Enterprise AI Customer Inquiry & Ticket Triage Platform)

---

### 1. Propósito y Posición en el Portfolio
- **Objetivo:** Diseñar y desplegar una plataforma empresarial de ingesta, clasificación inteligente y triaje automatizado de consultas de clientes mediante IA generativa en AWS.
- **Posición:** Proyecto 3 de 5 del portfolio Cloud, DevOps y SRE:
  - *Proyecto 1 (AI Inventory Tracker):* EKS, Go, DynamoDB Streams, ArgoCD GitOps, GitLab CI.
  - *Proyecto 2 (Automated Backup System):* AWS Backup Vault Lock (WORM), RDS, S3, EventBridge, GitHub Actions.
  - *Proyecto 3 (Customer Inquiry Manager):* ECS Fargate Spot, RDS PostgreSQL, Amazon Bedrock (Converse API), Amazon Cognito (Enforced TOTP MFA & RBAC), S3 Multi-Tier Lifecycle, AWS PrivateLink (Zero-Internet Egress), AWS X-Ray, CloudWatch SLI/SLO, AWS CodePipeline/CodeBuild/CodeDeploy y Terraform modular.

---

### 2. Reglas Cardinales de Implementación (Non-Negotiable Patterns)

1. **Estricta ausencia de analogías:** Toda explicación, documentación técnica y comentarios de código deben ser directos, técnicos y basados en especificaciones reales de ingeniería.
2. **Zero-Internet Egress (VPC Segura y FinOps):**
   - No se despliegan NAT Gateways (ahorro de ~65 €/mes).
   - Toda la comunicación de las tareas Fargate hacia los servicios de AWS (ECR, Bedrock, S3, Secrets Manager, CloudWatch, X-Ray) se canaliza obligatoriamente mediante **AWS PrivateLink (Interface VPC Endpoints)** y un **VPC Gateway Endpoint para S3**.
3. **Topología de Red 3-Tier (AWS Well-Architected):**
   - `public_subnets`: Balanceador ALB (conectado a Internet Gateway).
   - `private_subnets`: Cómputo (tareas ECS Fargate y endpoints VPC).
   - `database_subnets` (Aisladas): Amazon RDS PostgreSQL (`aws_db_subnet_group`). Su tabla de rutas contiene **únicamente la ruta local** (`10.0.0.0/16 -> local`), careciendo por completo de rutas hacia Internet o NAT.
4. **Política de Destrucción Limpia (Coste Residual 0.00 €):**
   - En Terraform: `force_destroy = true` en todos los buckets S3.
   - En RDS: `skip_final_snapshot = true` y `deletion_protection = false`.
   - `terraform destroy` debe ser capaz de eliminar el 100% de la infraestructura sin bloqueos por snapshots huérfanos o buckets no vacíos.
5. **Separación Estricta de Roles IAM:**
   - *Task Execution Role:* Utilizado por el agente de ECS para inicializar el contenedor (descargar imágenes de ECR, autenticarse y escribir logs iniciales en CloudWatch).
   - *Task Role:* Utilizado por el código de la aplicación FastAPI dentro del contenedor (invocar Amazon Bedrock, escribir en S3, emitir métricas a CloudWatch y trazas a X-Ray).
6. **Autenticación Empresarial Zero-Trust con MFA Forzado (Coste 0.00 €):**
   - El acceso a la consola de operaciones y a los endpoints administrativos exige obligatoriamente **Amazon Cognito User Pools** con **MFA por Software Token (TOTP)** configurado en modo estricto (`mfa_configuration = "ON"`).
   - Queda terminantemente prohibido el uso de SMS para MFA para evitar costes de telecomunicaciones y ataques de SIM swapping. TOTP opera bajo RFC 6238 a coste 0.00 € (incluido en las 50.000 MAUs del Free Tier).
   - Control de Acceso Basado en Roles (**RBAC**): separación estricta entre `Tier1_Agents` (resolución y aprobación de sugerencias) y `Operations_Managers` (auditoría, reasignación y métricas de SLA).
   - Tokens JWT (RS256) validados en memoria por FastAPI contra el JWKS de Cognito para latencias < 1 ms.

---

### 3. Resoluciones Técnicas Consolidadas (Dudas y Decisiones Resueltas)

#### A. Redes: ¿Por qué "Subredes Aisladas de Datos" si antes solo usamos Public y Private?
- En proyectos anteriores no se usó porque la base de datos era DynamoDB (servicio serverless sin subredes) o Lambdas aisladas.
- En este proyecto se despliega **Amazon RDS PostgreSQL**. En entornos empresariales auditados, las bases de datos no comparten subred con el cómputo: se ubican en subredes cuya tabla de enrutamiento **no tiene ninguna ruta `0.0.0.0/0`**, garantizando que el motor de base de datos no tenga capacidad física de iniciar conexiones hacia el exterior.

#### B. Almacenamiento: Estrategia FinOps de Clases de Amazon S3
No se utiliza una única clase para todo. Se aplican reglas de ciclo de vida automáticas (*S3 Lifecycle Rules*):
1. **Adjuntos de clientes (Feature 1 y 3):**
   - Días 1 a 60: **S3 Standard** (acceso frecuente durante el tratamiento activo del ticket).
   - Día 60 en adelante: Transición automática a **S3 Glacier Instant Retrieval** (acceso milisegundo para auditorías esporádicas a una fracción del coste).
2. **Logs de acceso del ALB:**
   - Días 1 a 30: **S3 Standard**.
   - Días 30 a 90: Transición a **S3 Glacier Flexible Retrieval** (acceso en horas para análisis forense).
   - Día 90: Expiración y borrado automático definitivo.
3. **Artefactos temporales de CI/CD (CodePipeline):**
   - **S3 Standard** con regla de expiración y borrado automático a los 3 días.

#### C. Seguridad: Rotación de Secretos en AWS Secrets Manager
- No se implementan Lambdas de rotación personalizadas (evita sobreingeniería y mantenimiento de código innecesario).
- Se utiliza la funcionalidad nativa de AWS: **`manage_master_user_password = true`** en el recurso `aws_db_instance` de Terraform. AWS gestiona la clave KMS, el secreto y la rotación programada de la contraseña maestra de PostgreSQL de forma 100% automática.

#### D. Observabilidad: AWS X-Ray
- **Mecánica:** La aplicación Python instrumenta peticiones mediante el `aws-xray-sdk` y envía paquetes UDP asíncronos al puerto `127.0.0.1:2000`.
- **Daemon Sidecar:** Un contenedor sidecar (`aws-xray-daemon`) en la misma tarea de Fargate recibe los paquetes UDP, los agrupa en memoria y los envía vía HTTPS a la API de X-Ray a través de su VPC Endpoint.
- **Trazabilidad:** Descompone los tiempos de ejecución de cada petición `/api/v1/inquiries`:
  - Tiempo de middleware FastAPI.
  - Tiempo de inferencia de Bedrock (`bedrock-runtime.converse`).
  - Tiempo de persistencia en PostgreSQL (consultas SQLAlchemy).
  - Tiempo de subida a S3.

#### E. Backend Python: Roles Exactos de cada Componente
- **Python 3.12:** Intérprete base (`python:3.12-slim`), sintaxis PEP 695 de tipos y bucle de eventos asíncrono.
- **Uvicorn:** **Servidor web ASGI**. Abre el socket TCP en el puerto `8000`, procesa bytes HTTP/1.1 y HTTP/2, y realiza el *graceful shutdown* interceptando señales `SIGTERM` enviadas por ECS.
- **FastAPI:** **Framework de enrutamiento y aplicación**. Define endpoints (`/api/v1/inquiries`, `/health`), maneja la inyección de dependencias y genera Swagger/OpenAPI en `/docs`.
- **Pydantic v2:** **Motor de validación en tiempo de ejecución (Runtime)**. Equivalente a Zod en TypeScript. Valida esquemas JSON entrantes (RFC email, rangos numéricos), valida y tipa estrictamente el JSON devuelto por Bedrock (`model_validate_json`), y gestiona las variables de entorno (`pydantic-settings`).
- **SQLAlchemy 2.0:** **ORM y Pool de Conexiones**. Consultas tipadas con `Mapped[...]`, protección absoluta contra inyecciones SQL mediante parametrización, y control de transacciones ACID (`commit`/`rollback`).
- **Boto3:** **AWS SDK**. Conexión firmada con SigV4 hacia Bedrock Converse API, generación de URLs prefirmadas de S3 y reporte de métricas custom a CloudWatch.

#### F. Inteligencia Artificial: Amazon Bedrock (Modelos y API)
- **Modelos:** Claude Haiku 4.5 (`anthropic.claude-haiku-4-5-20251001-v1:0`) como modelo primario por latencia/coste, y Amazon Nova Lite (`amazon.nova-lite-v1:0`) como alternativa.
- **Consola 2025/2026:** En la consola moderna de Bedrock (`eu-west-1`), los modelos serverless tienen acceso habilitado automáticamente; no se requiere el formulario antiguo de "Request Model Access".
- **Método de invocación:** API `converse()` enviando un `system prompt` estructurado y un esquema JSON forzado para extracción determinista (categoría, prioridad, urgencia [1-5], sentimiento, respuesta sugerida).

#### G. Seguridad e Identidad: Amazon Cognito con MFA por Software Token (TOTP) Obligatorio
- **Free Tier y FinOps:** 50.000 MAUs gratuitas de por vida (coste 0.00 €).
- **MFA Enforced (`mfa_configuration = "ON"`):** Software Token (TOTP - RFC 6238) compatible con Google Authenticator, Microsoft Authenticator y 1Password. Cero llamadas o cargos de SMS/telecomunicaciones vía SNS.
- **Flujo Criptográfico:**
  - Desafío `SOFTWARE_TOKEN_MFA` tras autenticación inicial.
  - Generación de secreto TOTP y código QR en el enrolamiento.
  - Emisión de tokens JWT estándar (RS256) con claims de rol y expiración corta (1 hora).
- **RBAC:** Grupos `Tier1_Agents` y `Operations_Managers`.
- **Auditoría Human-in-the-Loop (HITL):** Cada aprobación o modificación de tickets persiste el `cognito_sub` del agente en PostgreSQL para trazabilidad completa.

#### H. Consola Operativa: Enterprise Agent Triage Console (React 18/19 Vite)
- **Naturaleza del Frontend:** Herramienta interna de alta densidad operativa construida con **React 18/19 (Vite)** (el estándar del 80%+ del mercado para consolas y backoffices).
- **Patrón Single-Pass Production Asset:** Compilación en la fase 1 del Dockerfile (Node.js 20) y copiado de los estáticos resultantes a `/app/static/` en la fase 2 (`python:3.12-slim`). En producción en Fargate se ejecuta con **0 MB de sobrecoste de Node.js en runtime**.
- **Diseño & UX:** Dark mode corporativo de alta densidad (estilo Linear/Datadog), badges cromáticos por severidad (P1 rojo, P2 ámbar, P3 azul, P4 verde), temporizadores regresivos en vivo de SLA y modal de enrolamiento TOTP con código QR.
- **Funcionalidades Clave:**
  - Login con desafío TOTP MFA (6 dígitos).
  - Bandeja reactiva de tickets filtrable con ordenación por criticidad y cuenta regresiva de SLA.
  - Vista dividida: detalles del cliente, análisis de sentimiento, detección de frustración, entidades detectadas y borrador de IA.
  - Reclamo atómico de tickets con control de concurrencia optimista (evita colisiones entre agentes).
  - Aprobación y edición del borrador en 1 clic (*Human-in-the-Loop*).

---

### 4. Estructura de Directorios del Repositorio

```text
customer-inquiry-manager/
├── .github/
│   └── workflows/
│       └── pr-verify.yml             # Linter y validaciones en PR
├── app/                              # Backend FastAPI
│   ├── api/
│   │   ├── v1/
│   │   │   ├── endpoints/
│   │   │   │   ├── auth.py           # Login, TOTP MFA challenge, verify y refresh
│   │   │   │   ├── inquiries.py      # POST /inquiries, GET /inquiries, PATCH claim/resolve
│   │   │   │   └── attachments.py    # Presigned URLs y subida S3
│   │   │   └── router.py
│   │   └── health.py                 # /health/live, /health/ready
│   ├── core/
│   │   ├── config.py                 # Pydantic BaseSettings
│   │   ├── database.py               # SQLAlchemy async engine & sessionmaker (asyncpg)
│   │   ├── security.py               # Verificación JWT Cognito (JWKS RS256) & RBAC
│   │   └── telemetry.py              # X-Ray & CloudWatch EMF setup
│   ├── models/                       # Modelos ORM SQLAlchemy (JSONB + GIN)
│   │   ├── inquiry.py
│   │   └── audit.py
│   ├── schemas/                      # Esquemas Pydantic v2
│   │   ├── auth.py                   # Esquemas login, MFA y tokens
│   │   ├── inquiry.py
│   │   └── bedrock.py                # Schema forzado para la respuesta del LLM
│   ├── services/                     # Lógica de negocio
│   │   ├── bedrock_service.py        # Boto3 Bedrock Converse integration + Grounding
│   │   ├── cognito_service.py        # Boto3 Cognito Admin & Auth integration
│   │   └── s3_service.py             # Boto3 S3 upload & presigned URLs
│   ├── tests/
│   │   ├── test_inquiries.py
│   │   ├── test_bedrock_schema.py
│   │   └── test_auth.py
│   ├── buildspec.yml                 # AWS CodeBuild (pytest + semgrep + trivy + docker build)
│   └── requirements.txt
├── frontend/                         # Consola de Operaciones React (Vite)
│   ├── src/
│   │   ├── components/               # TicketQueue, TicketDetail, TOTPModal, SLATimer
│   │   ├── services/                 # API client, Cognito auth
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── index.html
│   ├── vite.config.ts
│   └── package.json
├── company_profile.json              # Anclaje de contexto (Grounding) agnóstico
├── Dockerfile                        # Multi-stage: Stage 1 Node.js build -> Stage 2 Python 3.12-slim
├── terraform/
│   ├── environments/
│   │   └── dev/
│   │       ├── main.tf
│   │       ├── variables.tf
│   │       ├── outputs.tf
│   │       └── terraform.tfvars
│   └── modules/
│       ├── vpc/                      # 3-tier subnets + VPC Endpoints
│       ├── security_groups/          # Reglas mínimas necesarias
│       ├── cognito/                  # User Pool, TOTP MFA, Client & RBAC Groups
│       ├── rds/                      # RDS Postgres + native Secrets Manager
│       ├── s3/                       # Buckets + Lifecycle + KMS
│       ├── ecs/                      # Cluster, Fargate Spot Task (App + X-Ray)
│       ├── alb/                      # ALB, Target Groups, Health Checks
│       ├── iam/                      # Execution Role vs Task Role
│       ├── monitoring/               # CloudWatch Dashboards & X-Ray
│       └── cicd/                     # CodePipeline, CodeBuild, CodeDeploy
├── scripts/
│   ├── seed_inquiries.py             # Test harness omnicanal (HMAC Stripe/Trustpilot)
│   ├── k6-load-test.js               # Pruebas de estrés y autoescalado (15-50 VUs)
│   ├── deploy.sh                     # Pipeline trigger / Terraform apply
│   └── destroy.sh                    # Teardown verificado a 0.00 €
├── LICENSE
├── README.md
└── PROJECT_CONTEXT.md
```
