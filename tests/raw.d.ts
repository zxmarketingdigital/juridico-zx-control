// Permite importar arquivos como string crua (Vite `?raw`) nos testes —
// usado para validar o SQL da migration sem precisar de acesso a disco no
// pool workerd do vitest.
declare module "*?raw" {
  const content: string;
  export default content;
}
