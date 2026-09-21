import {
  renderEmail,
  escapeHtml,
} from '../../../src/core/infrastructure/messaging/email-template';

describe('renderEmail', () => {
  it('usa los colores de marca del sistema de diseño', () => {
    const html = renderEmail({ title: 'Confirma tu correo', body: ['Hola'] });

    expect(html).toContain('#E4572E'); // brasa (--primary)
    expect(html).toContain('#FAF7F0'); // crema (--background)
    expect(html).toContain('#17201B'); // carbón (--foreground)
    expect(html).toContain('RESTIFY');
    expect(html).not.toContain('#b45309'); // acento viejo (amber-700)
  });

  it('renderiza label, greeting, action y footer cuando se pasan', () => {
    const html = renderEmail({
      label: 'Verificación de correo',
      title: 'Confirma tu correo',
      greeting: 'Hola Brayan,',
      body: ['Gracias por registrarte en Restify.'],
      action: { label: 'Verificar mi cuenta', url: 'https://restify.app/verify-email?token=abc' },
      footer: 'El enlace caduca en 24 horas.',
    });

    expect(html).toContain('Verificación de correo');
    expect(html).toContain('Hola Brayan,');
    expect(html).toContain('Verificar mi cuenta');
    expect(html).toContain('https://restify.app/verify-email?token=abc');
    expect(html).toContain('El enlace caduca en 24 horas.');
  });

  it('omite el bloque de acción cuando no hay action', () => {
    const html = renderEmail({ title: 'Hola', body: ['x'] });

    expect(html).not.toContain('O pega este enlace');
  });
});

describe('escapeHtml', () => {
  it('escapa los caracteres peligrosos para HTML', () => {
    expect(escapeHtml('<script>alert("x")</script>')).toBe(
      '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;'
    );
  });
});
