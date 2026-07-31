/**
 * Tokens inspirados no SAP Fiori Design System (tema Horizon/Quartz Light),
 * aproximados ("Fiori-like") em vez de importados via biblioteca de
 * componentes SAP — ver docs/02-arquitetura-tecnica.md secção 5 para a
 * justificação. Valores de cor documentados por uso (não são um pacote
 * oficial redistribuído).
 */
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        fiori: {
          shell: '#354A5F', // barra superior (SAP Shell Bar)
          'shell-dark': '#223548',
          primary: '#0070F2', // azul de marca/interativo (Fiori "Brand Blue")
          'primary-hover': '#0057D2',
          'primary-active': '#004B8D',
          'primary-bg': '#F5FAFF',
          canvas: '#F5F6F7', // fundo de página
          surface: '#FFFFFF', // cards/tabelas
          border: '#D9D9D9',
          'border-strong': '#89919A',
          text: '#1D2D3E',
          'text-secondary': '#6A6D70',
          'text-inverse': '#FFFFFF',
          success: '#107E3E',
          'success-bg': '#F1FDF6',
          warning: '#E76500',
          'warning-bg': '#FEF7F1',
          error: '#BB0000',
          'error-bg': '#FFEBEB',
          info: '#0070F2',
          'info-bg': '#F5FAFF',
        },
      },
      fontFamily: {
        // "72" é a fonte proprietária da SAP — sem licença/CDN público para
        // a distribuir aqui, por isso fica declarada primeiro (uma
        // organização com licença pode auto-hospedá-la) mas cai sempre em
        // Arial/Segoe UI na prática, tal como pedido.
        sans: ['"72"', '"72full"', 'Arial', '"Segoe UI"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        fiori: '0 0 0 1px rgba(0,0,0,0.05), 0 2px 4px 0 rgba(0,0,0,0.08)',
      },
    },
  },
  plugins: [],
};
