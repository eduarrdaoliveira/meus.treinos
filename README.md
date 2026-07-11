# Meus.Treinos — v0.1

Aplicativo React + TypeScript conectado ao projeto Firebase `treinos-281f6`.

## O que já funciona

- login com Google;
- cadastro, edição e exclusão de exercícios;
- criação e edição de modelos de treino;
- treino do dia com peso, repetições, conclusão de séries e observações;
- conclusão do treino;
- histórico salvo no Cloud Firestore;
- dados separados por usuário;
- layout responsivo.

## Publicar sem terminal

A pasta `docs` já contém a versão compilada.

1. Envie todos os arquivos deste projeto para o repositório GitHub `meus.treinos`.
2. No repositório, abra **Settings > Pages**.
3. Em **Build and deployment**, escolha **Deploy from a branch**.
4. Escolha a branch **main** e a pasta **/docs**.
5. Clique em **Save**.
6. Aguarde o GitHub exibir o endereço publicado.
7. No Firebase Console, abra **Authentication > Settings > Authorized domains**.
8. Adicione apenas o domínio do endereço do GitHub, por exemplo: `seuusuario.github.io`.

## Desenvolvimento futuro

O código-fonte está em `src`. A versão publicada é gerada em `docs` pelo comando:

```bash
npm install
npm run build
```
