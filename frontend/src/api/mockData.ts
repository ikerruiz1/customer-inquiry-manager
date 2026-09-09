import {
  ChannelEnum,
  DepartmentEnum,
  PriorityEnum,
  InquiryStatusEnum,
  ResponseStrategyEnum,
} from '../types/inquiry';
import type { Inquiry, AgentProfile } from '../types/inquiry';

export const INITIAL_AGENTS: AgentProfile[] = [
  {
    id: '00000000-0000-0000-0000-000000000001',
    name: 'Carlos M.',
    email: 'carlos.m@cloudscale.io',
    role: 'Tier1_Agent',
    initials: 'CM',
    color: '#3b82f6', // Blue
  },
  {
    id: '00000000-0000-0000-0000-000000000002',
    name: 'Laura G.',
    email: 'laura.g@cloudscale.io',
    role: 'Tier1_Agent',
    initials: 'LG',
    color: '#10b981', // Emerald
  },
  {
    id: '00000000-0000-0000-0000-000000000099',
    name: 'Alex Rivera (Lead)',
    email: 'alex.rivera@cloudscale.io',
    role: 'Operations_Manager',
    initials: 'AR',
    color: '#8b5cf6', // Purple
  },
];

const now = Date.now();

export const INITIAL_INQUIRIES: Inquiry[] = [
  {
    id: 'b1a2c3d4-0001-4000-8000-000000000001',
    channel: ChannelEnum.BILLING,
    customer_email: 'cto@fintech-pay.io',
    customer_name: 'Elena Rostova',
    subject: '[DISPUTA BANCARIA] Retención de 450.00 EUR en cuenta Enterprise',
    body: 'Nos han bloqueado 450.00 EUR por una supuesta disputa no reconocida en Stripe (ref: dp_88421). Si los fondos no son liberados antes de las 18:00 UTC, cancelaremos nuestras 25 licencias Enterprise y trasladaremos nuestra infraestructura a la competencia.',
    status: InquiryStatusEnum.UNASSIGNED,
    department: DepartmentEnum.BILLING,
    priority: PriorityEnum.P1,
    urgency: 5,
    impact: 3,
    sentiment_score: -0.85,
    churn_risk: true,
    entities: {
      order_id: 'dp_88421',
      monetary_amount: '450.00 EUR',
      customer_deadline: 'Hoy 18:00 UTC',
      product_affected: 'ExampleCorp Billing Gateway',
    },
    confidence_score: 0.98,
    triage_rationale:
      'Clasificado en BILLING (P1) debido a retención indebida de 450.00 EUR en disputa bancaria Stripe con amenaza explícita de rescisión de 25 licencias Enterprise (riesgo crítico de churn).',
    bedrock_latency_ms: 612,
    suggested_strategy: ResponseStrategyEnum.EMPATHETIC_DEFUSING,
    suggested_response:
      'Estimado equipo de FinTech Pay, hemos paralizado cautelarmente la retención de fondos y transferido el expediente al equipo de tesorería senior para conciliar la disputa dp_88421 con la entidad bancaria. Nos pondremos en contacto antes de las 18:00 UTC con la resolución definitiva.',
    agent_copilot_notes:
      'Nota Interna: El cliente tiene contratado el plan Enterprise anual (MRR: 4.800€). No rechazar la disputa sin consultar antes con el departamento de cuentas clave.',
    sla_deadline_at: new Date(now + 28 * 60 * 1000).toISOString(), // 28 mins left
    human_reviewed: false,
    created_at: new Date(now - 15 * 60 * 1000).toISOString(),
    updated_at: new Date(now - 15 * 60 * 1000).toISOString(),
  },
  {
    id: 'b1a2c3d4-0002-4000-8000-000000000002',
    channel: ChannelEnum.EMAIL,
    customer_email: 'sre-team@nexuscloud.com',
    customer_name: 'David Vance',
    subject: 'Caída general: 504 Gateway Timeout en clúster gestionado de Kubernetes',
    body: 'Desde el release de las 14:00, todos los pods en el clúster k8s-prod-eu1 están arrojando error 504 Gateway Timeout y fallando con código ERR_POD_OOMKILLED. Nuestros clientes no pueden acceder al checkout de pagos.',
    status: InquiryStatusEnum.CLAIMED,
    department: DepartmentEnum.TECH_SUPPORT,
    priority: PriorityEnum.P1,
    urgency: 5,
    impact: 3,
    sentiment_score: -0.72,
    churn_risk: true,
    entities: {
      error_code: '504 Gateway Timeout / ERR_POD_OOMKILLED',
      product_affected: 'ExampleCorp Managed K8s',
      order_id: 'k8s-prod-eu1',
    },
    confidence_score: 0.99,
    triage_rationale:
      'Incidencia crítica de servicio (P1): interrupción total del pipeline de pagos por fallo de memoria OOM en clúster k8s de producción.',
    bedrock_latency_ms: 580,
    suggested_strategy: ResponseStrategyEnum.DIRECT_RESOLUTION,
    suggested_response:
      'Hola David, hemos identificado un estrangulamiento de memoria en los nodos de control de k8s-prod-eu1. Nuestro equipo SRE está aprovisionando nodos de cómputo adicionales para restablecer el tráfico de pods de inmediato.',
    agent_copilot_notes:
      'Nota Interna: Se ha verificado en CloudWatch que el nodo worker-04 alcanzó 99% de RAM. Desplegando autoscaling.',
    sla_deadline_at: new Date(now + 42 * 60 * 1000).toISOString(), // 42 mins left
    assigned_agent_id: '00000000-0000-0000-0000-000000000001', // Claimed by Carlos M.
    claimed_at: new Date(now - 5 * 60 * 1000).toISOString(),
    human_reviewed: false,
    created_at: new Date(now - 20 * 60 * 1000).toISOString(),
    updated_at: new Date(now - 5 * 60 * 1000).toISOString(),
  },
  {
    id: 'b1a2c3d4-0003-4000-8000-000000000003',
    channel: ChannelEnum.TRUSTPILOT,
    customer_email: 'marcos.dev@outlook.com',
    customer_name: 'Marcos Benítez',
    subject: '[Trustpilot 1★] Pésimo soporte y lentitud extrema en la API',
    body: 'Llevo 3 días esperando a que me activen el certificado SSL en mi dominio personalizado. El soporte es inexistente y mi tienda online sigue dando aviso de sitio inseguro. Una vergüenza.',
    status: InquiryStatusEnum.UNASSIGNED,
    department: DepartmentEnum.ACCOUNTS,
    priority: PriorityEnum.P2,
    urgency: 4,
    impact: 2,
    sentiment_score: -0.92,
    churn_risk: true,
    entities: {
      product_affected: 'ExampleCorp Custom Domains / SSL',
    },
    confidence_score: 0.94,
    triage_rationale:
      'Reseña pública de 1 estrella en Trustpilot con alto impacto reputacional. Requiere protocolo urgente de desescalada.',
    bedrock_latency_ms: 630,
    suggested_strategy: ResponseStrategyEnum.EMPATHETIC_DEFUSING,
    suggested_response:
      'Hola Marcos, lamentamos profundamente el retraso en la emisión de tu certificado SSL. Hemos forzado la validación DNS de tu dominio de forma prioritaria para que quede activo en los próximos 10 minutos.',
    agent_copilot_notes:
      'Nota Interna: Validar en Route53 que los registros CNAME no tengan conflicto antes de contestar.',
    sla_deadline_at: new Date(now + 95 * 60 * 1000).toISOString(), // 1h 35m left
    human_reviewed: false,
    created_at: new Date(now - 45 * 60 * 1000).toISOString(),
    updated_at: new Date(now - 45 * 60 * 1000).toISOString(),
  },
  {
    id: 'b1a2c3d4-0004-4000-8000-000000000004',
    channel: ChannelEnum.WEB_FORM,
    customer_email: 'jorge.developer@saasapp.es',
    customer_name: 'Jorge Salgado',
    subject: 'Duda sobre configuración de cabeceras CORS en Gateway API',
    body: 'Estamos integrando el frontend en React con el Gateway API de ExampleCorp y recibimos error de CORS origin not allowed desde localhost:5173. ¿Podríais indicarnos cómo añadir el origen en el archivo de configuración?',
    status: InquiryStatusEnum.UNASSIGNED,
    department: DepartmentEnum.TECH_SUPPORT,
    priority: PriorityEnum.P3,
    urgency: 2,
    impact: 1,
    sentiment_score: 0.1,
    churn_risk: false,
    entities: {
      product_affected: 'ExampleCorp Gateway API',
      error_code: 'CORS Origin Not Allowed',
    },
    confidence_score: 0.97,
    triage_rationale:
      'Consulta técnica habitual de integración (P3). Cero riesgo de churn, tono educado y colaborativo.',
    bedrock_latency_ms: 540,
    suggested_strategy: ResponseStrategyEnum.DIRECT_RESOLUTION,
    suggested_response:
      'Hola Jorge, para habilitar orígenes locales en el Gateway API, edita tu bloque de configuración en app/core/config.py o mediante la variable CORS_ORIGINS = ["http://localhost:5173"]. Adjuntamos el enlace a la documentación oficial.',
    agent_copilot_notes:
      'Nota Interna: Enviar enlace al capítulo 4 de la guía de microservicios.',
    sla_deadline_at: new Date(now + 7 * 60 * 60 * 1000).toISOString(), // 7h left
    human_reviewed: false,
    created_at: new Date(now - 1 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(now - 1 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'b1a2c3d4-0005-4000-8000-000000000005',
    channel: ChannelEnum.EMAIL,
    customer_email: 'legal@enterprise-corp.de',
    customer_name: 'Klaus Schmidt',
    subject: 'Solicitud formal de derecho de supresión de datos (Artículo 17 GDPR)',
    body: 'Por medio de la presente, solicitamos el borrado definitivo e irrevocable de todos los datos personales y registros de telemetría asociados a nuestra cuenta de cliente 991823 antes de 30 días naturales.',
    status: InquiryStatusEnum.UNASSIGNED,
    department: DepartmentEnum.SECURITY,
    priority: PriorityEnum.P2,
    urgency: 3,
    impact: 3,
    sentiment_score: 0.0,
    churn_risk: false,
    entities: {
      order_id: 'Account-991823',
      customer_deadline: '30 días naturales',
    },
    confidence_score: 0.99,
    triage_rationale:
      'Petición formal de cumplimiento normativo legal / GDPR. Asignado a SECURITY con SLA prioritario P2.',
    bedrock_latency_ms: 605,
    suggested_strategy: ResponseStrategyEnum.ESCALATION,
    suggested_response:
      'Estimado Klaus Schmidt, acusamos recibo de su solicitud de supresión de datos conforme al RGPD. Hemos iniciado el expediente SEC-GDPR-2026 y nuestro Delegado de Protección de Datos (DPO) le remitirá el certificado de purga en un plazo máximo de 7 días hábiles.',
    agent_copilot_notes:
      'Nota Interna: Notificar obligatoriamente a dpo@cloudscale.io antes de confirmar el borrado físico en RDS.',
    sla_deadline_at: new Date(now + 3 * 60 * 60 * 1000).toISOString(), // 3h left
    human_reviewed: false,
    created_at: new Date(now - 2 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(now - 2 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'b1a2c3d4-0006-4000-8000-000000000006',
    channel: ChannelEnum.EMAIL,
    customer_email: 'promo@global-marketing-agency.com',
    customer_name: 'Commercial Lead',
    subject: 'Offshore backlink and SEO rank enhancement services',
    body: 'Dear Webmaster, we noticed your website ranking could improve. We offer premium link building packages starting at $99/mo.',
    status: InquiryStatusEnum.UNASSIGNED,
    department: DepartmentEnum.GENERAL,
    priority: PriorityEnum.P4,
    urgency: 1,
    impact: 1,
    sentiment_score: 0.0,
    churn_risk: false,
    entities: {},
    confidence_score: 0.99,
    triage_rationale:
      'Correo no solicitado de prospección comercial externa (Spam). Sin impacto operativo.',
    bedrock_latency_ms: 450,
    suggested_strategy: ResponseStrategyEnum.DIRECT_RESOLUTION,
    suggested_response: 'Mensaje archivado automáticamente como irrelevante.',
    agent_copilot_notes: 'Nota Interna: Sin acción requerida. Proceder a resolución directa.',
    sla_deadline_at: new Date(now + 23 * 60 * 60 * 1000).toISOString(), // 23h left
    human_reviewed: false,
    created_at: new Date(now - 3 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(now - 3 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'b1a2c3d4-0007-4000-8000-000000000007',
    channel: ChannelEnum.WEB_FORM,
    customer_email: 'sarah.connor@cyberdyne.io',
    customer_name: 'Sarah Connor',
    subject: 'Problema al actualizar método de pago con tarjeta corporativa',
    body: 'La pasarela me devolvía error 402 Card Declined con tarjeta corporativa emitida en Reino Unido.',
    status: InquiryStatusEnum.RESOLVED,
    department: DepartmentEnum.BILLING,
    priority: PriorityEnum.P2,
    urgency: 4,
    impact: 2,
    sentiment_score: -0.4,
    churn_risk: false,
    entities: {
      error_code: '402 Card Declined',
    },
    confidence_score: 0.96,
    triage_rationale: 'Fallo de procesamiento 3DS en facturación resuelto.',
    bedrock_latency_ms: 590,
    suggested_strategy: ResponseStrategyEnum.DIRECT_RESOLUTION,
    suggested_response:
      'Hola Sarah, el banco emisor requería verificación 3DS en dos pasos. Hemos habilitado el enlace seguro de confirmación.',
    resolution_text:
      'Hola Sarah, hemos habilitado la pasarela con soporte multi-divisa 3DS v2. Tu tarjeta ha sido verificada y el recibo queda emitido con éxito.',
    assigned_agent_id: '00000000-0000-0000-0000-000000000001',
    claimed_at: new Date(now - 4 * 60 * 60 * 1000).toISOString(),
    resolved_at: new Date(now - 3 * 60 * 60 * 1000).toISOString(),
    human_reviewed: true,
    was_edited: true,
    edit_character_distance: 42,
    sla_deadline_at: new Date(now - 2 * 60 * 60 * 1000).toISOString(),
    created_at: new Date(now - 5 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(now - 3 * 60 * 60 * 1000).toISOString(),
  },
];
