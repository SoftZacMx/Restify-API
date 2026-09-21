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
// así que el correo se ve igual sin cargar fuentes externas. Manrope (la fuente del
// sistema de diseño) no se carga de forma fiable en email, así que la marca usa el
// mismo serif que las pantallas de auth del frontend (`font-serif`).
const SERIF = "Georgia, 'Times New Roman', serif";
const SANS = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
const MONO = "'SFMono-Regular', Menlo, Consolas, 'Liberation Mono', monospace";

// Tokens resueltos del sistema de diseño (Restify-Frontend/src/index.css).
// Email no soporta CSS vars ni HSL, así que van como HEX en un solo lugar.
const BACKGROUND = '#FAF7F0'; // --background (crema, nunca blanco puro)
const SURFACE = '#FFFFFF'; // --card (superficie)
const INK = '#17201B'; // --foreground / --color-marca (carbón)
const MUTED = '#6B726B'; // --muted-foreground (texto suave)
const RULE = '#ECE7DE'; // --border (hairline crema)
const ACCENT = '#E4572E'; // --primary (brasa, acciones/CTA)
const ACCENT_FG = '#FAF8F4'; // --primary-foreground (crema sobre brasa)

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
    ? `<p style="margin:0 0 18px;font-family:${SANS};font-size:16px;line-height:26px;color:${INK};">${greeting}</p>`
    : '';

  const bodyHtml = body
    .map(
      (text) =>
        `<p style="margin:0 0 18px;font-family:${SANS};font-size:16px;line-height:26px;color:${INK};">${text}</p>`
    )
    .join('');

  const actionHtml = action
    ? `
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0 32px;">
                <tr>
                  <td style="background:${ACCENT};border-radius:8px;">
                    <a href="${action.url}" style="display:inline-block;padding:14px 28px;font-family:${SANS};font-size:15px;font-weight:600;color:${ACCENT_FG};text-decoration:none;border-radius:8px;">${action.label}</a>
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
<body style="margin:0;padding:0;background:${BACKGROUND};">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${BACKGROUND};">
    <tr>
      <td align="center" style="padding:48px 20px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="520" align="center" style="max-width:520px;width:100%;background:${SURFACE};border:1px solid ${RULE};border-radius:12px;">
          <tr>
            <td style="padding:40px 40px 36px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td style="padding-bottom:36px;">
                    <span style="font-family:${SERIF};font-size:19px;font-weight:bold;letter-spacing:0.04em;color:${INK};">${BRAND.toUpperCase()}</span><span style="font-family:${SERIF};font-size:19px;color:${ACCENT};">.</span>
                  </td>
                </tr>
              </table>
              ${labelHtml}
              <h1 style="margin:0 0 24px;font-family:${SERIF};font-size:30px;line-height:38px;font-weight:normal;color:${INK};">${title}</h1>
              ${greetingHtml}
              ${bodyHtml}
              ${actionHtml}
              ${footerHtml}
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td style="padding-top:40px;">
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
      </td>
    </tr>
  </table>
</body>
</html>`;
}
