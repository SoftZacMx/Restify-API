export interface EmailTemplateParams {
  /** Etiqueta de tipo de correo, en mayúsculas: "Verificación de correo". */
  label?: string;
  /** Titular. */
  title: string;
  /** Saludo: "Hola Brayan,". */
  greeting?: string;
  /** Párrafos del cuerpo. Admiten HTML en línea (por ejemplo `<strong>`). */
  body: string[];
  /** Botón principal. Debajo se repite la URL para clientes que no muestran botones. */
  action?: { label: string; url: string };
  /** Nota al cierre: caducidad del enlace, qué hacer si no fue el usuario. */
  footer?: string;
}

const BRAND = 'Restify';

// Estilos en línea y estructura en tablas: Gmail descarta hojas de estilo y Outlook
// no maqueta con divs. Las tres familias son las que existen en todos los clientes,
// así que el correo se ve igual sin cargar fuentes externas.
const SERIF = "Georgia, 'Times New Roman', serif";
const SANS = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
const MONO = "'SFMono-Regular', Menlo, Consolas, 'Liberation Mono', monospace";

const INK = '#1c1917';
const BODY = '#44403c';
const MUTED = '#a8a29e';
const RULE = '#e7e5e4';
const ACCENT = '#b45309';

/** Escapa valores dinámicos (nombres, correos) antes de interpolarlos en el HTML. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function renderEmail(params: EmailTemplateParams): string {
  const { label, title, greeting, body, action, footer } = params;

  const labelHtml = label
    ? `<p style="margin:0 0 20px;font-family:${MONO};font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:${ACCENT};">${label}</p>`
    : '';

  const greetingHtml = greeting
    ? `<p style="margin:0 0 18px;font-family:${SANS};font-size:16px;line-height:26px;color:${BODY};">${greeting}</p>`
    : '';

  const bodyHtml = body
    .map(
      (text) =>
        `<p style="margin:0 0 18px;font-family:${SANS};font-size:16px;line-height:26px;color:${BODY};">${text}</p>`
    )
    .join('');

  const actionHtml = action
    ? `
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0 32px;">
                <tr>
                  <td style="background:${ACCENT};">
                    <a href="${action.url}" style="display:inline-block;padding:14px 28px;font-family:${SANS};font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;">${action.label}</a>
                  </td>
                </tr>
              </table>
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td style="border-top:1px solid ${RULE};padding-top:16px;">
                    <p style="margin:0 0 6px;font-family:${SANS};font-size:13px;color:${MUTED};">O pega este enlace en tu navegador</p>
                    <a href="${action.url}" style="font-family:${MONO};font-size:12px;line-height:18px;color:${MUTED};word-break:break-all;text-decoration:none;">${action.url}</a>
                  </td>
                </tr>
              </table>`
    : '';

  const footerHtml = footer
    ? `<p style="margin:28px 0 0;font-family:${SANS};font-size:13px;line-height:20px;color:${MUTED};">${footer}</p>`
    : '';

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="light" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#ffffff;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#ffffff;">
    <tr>
      <td align="center" style="padding:48px 28px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="520" align="center" style="max-width:520px;width:100%;margin:0 auto;text-align:left;">
          <tr>
            <td style="padding-bottom:40px;">
              <span style="font-family:${SERIF};font-size:19px;font-weight:bold;color:${INK};">${BRAND}</span><span style="font-family:${SERIF};font-size:19px;color:${ACCENT};">.</span>
            </td>
          </tr>
          <tr>
            <td>
              ${labelHtml}
              <h1 style="margin:0 0 24px;font-family:${SERIF};font-size:30px;line-height:38px;font-weight:normal;color:${INK};">${title}</h1>
              ${greetingHtml}
              ${bodyHtml}
              ${actionHtml}
              ${footerHtml}
            </td>
          </tr>
          <tr>
            <td style="padding-top:44px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td style="border-top:1px solid ${RULE};padding-top:16px;font-family:${MONO};font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:${MUTED};">
                    ${BRAND} — Punto de venta para restaurantes
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
