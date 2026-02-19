# 🐛 Bug: Pessoa fica presa na tela do QR Code após pagar

## Descrição do Problema

Quando o cliente paga via **PIX (QR Code)**, ele fica preso na tela do Mercado Pago e **não é redirecionado** automaticamente para a `sucesso.html`.

## Causa Raiz

O parâmetro `auto_return: "approved"` configurado na preferência do Mercado Pago **funciona apenas com cartão de crédito**. Com PIX, o MP não faz redirecionamento automático porque o pagamento é assíncrono.

Trecho do backend atual (`criar-pagamento.js`) que mostra a config:

```js
const preferenceBody = {
    // ...
    back_urls: {
        success: `${BASE_URL}/sucesso.html`,
        failure: `${BASE_URL}/falha.html`,
        pending: `${BASE_URL}/pendente.html`
    },
    auto_return: "approved", // ⚠️ Só funciona com cartão, não com PIX
};
```

## ✅ Solução: Polling de Status do Pagamento

Criar uma **Netlify Function** nova chamada `verificar-pagamento.js` que consulta o status do pagamento no Mercado Pago. O frontend fica chamando essa função a cada 5 segundos enquanto o cliente está na tela do QR code. Quando o status retornar `approved`, redireciona para `sucesso.html`.

---

## 📁 Arquivos a Criar/Modificar

### 1. CRIAR: `netlify/functions/verificar-pagamento.js`

```js
const { MercadoPagoConfig, Payment } = require('mercadopago');

exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
    };

    const { preferenceId } = event.queryStringParameters || {};

    if (!preferenceId) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'preferenceId obrigatório' }) };
    }

    const client = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN_PROD });
    const paymentClient = new Payment(client);

    // Busca pagamentos associados à preferência
    const search = await paymentClient.search({
        options: { criteria: 'desc', external_reference: preferenceId }
    });

    const payments = search.results || [];
    const approved = payments.find(p => p.status === 'approved');

    if (approved) {
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ status: 'approved', paymentId: approved.id })
        };
    }

    const latest = payments[0];
    return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ status: latest?.status || 'pending' })
    };
};
```

### 2. MODIFICAR: `criar-pagamento.js`

Adicionar o `external_reference` com o mesmo valor usado para a busca depois. Substituir a linha atual:

```js
external_reference: `ORDER-${Date.now()}`
```

Por uma variável para reutilizar:

```js
const externalRef = `ORDER-${Date.now()}`;

// e no preferenceBody:
external_reference: externalRef,

// e no retorno:
body: JSON.stringify({
    redirectUrl: response.init_point,
    preferenceId: response.id,
    externalRef: externalRef  // ⬅️ Adicionar isso
})
```

### 3. MODIFICAR: `public/js/script.js`

Após receber a resposta do backend e redirecionar para o MP, salvar o `externalRef` no `localStorage` e **NÃO** redirecionar para o MP — em vez disso, mostrar o QR Code inline OU, se redirecionar, criar uma página intermediária que faça o polling.

**Opção mais simples** — Após o redirecionamento para o Mercado Pago, criar uma página `aguardando.html` que recebe o `externalRef` via URL e faz o polling:

No `script.js`, ao invés de:
```js
window.location.href = data.redirectUrl;
```

Fazer:
```js
// Salva a referência e abre o MP em nova aba
localStorage.setItem('externalRef', data.externalRef);
window.open(data.redirectUrl, '_blank');
window.location.href = `/aguardando.html?ref=${data.externalRef}`;
```

### 4. CRIAR: `aguardando.html`

Página que fica verificando o status e redireciona quando aprovado:

```html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <title>Aguardando Pagamento...</title>
</head>
<body>
    <h2>⏳ Aguardando confirmação do pagamento...</h2>
    <p>Assim que o pagamento for confirmado, você será redirecionado automaticamente.</p>

    <script>
        const params = new URLSearchParams(window.location.search);
        const ref = params.get('ref');

        async function verificar() {
            try {
                const res = await fetch(`/.netlify/functions/verificar-pagamento?preferenceId=${ref}`);
                const data = await res.json();

                if (data.status === 'approved') {
                    window.location.href = '/sucesso.html';
                }
            } catch (e) {
                console.error('Erro ao verificar:', e);
            }
        }

        // Verifica a cada 5 segundos
        if (ref) {
            setInterval(verificar, 5000);
            verificar(); // Verifica imediatamente também
        }
    </script>
</body>
</html>
```

---

## 🔑 Variáveis de Ambiente Necessárias (Netlify)

Confirmar que estão configuradas em **Netlify → Site → Environment variables**:

| Variável | Descrição |
|---|---|
| `MP_ACCESS_TOKEN_PROD` | Token de produção do Mercado Pago (começa com `APP_USR-`) |
| `SITE_URL` | URL do site, ex: `https://sccosplay.com.br` |
| `SUPABASE_URL` | URL do projeto Supabase |
| `SUPABASE_SERVICE_KEY` | Chave `service_role` do Supabase |

---

## 📋 Resumo das Mudanças

| Arquivo | Ação |
|---|---|
| `netlify/functions/verificar-pagamento.js` | Criar do zero |
| `netlify/functions/criar-pagamento.js` | Pequena modificação para retornar `externalRef` |
| `public/js/script.js` | Modificar o redirect para salvar ref e abrir MP em nova aba |
| `aguardando.html` | Criar do zero |

---

## ⚠️ Observação sobre o Email

O webhook (`webhook-mercadopago.js`) já está preparado para enviar email via Netlify Forms quando o pagamento é aprovado. Para o email chegar, é necessário configurar a notificação em:

**Netlify → Forms → vendas → Form notifications → Add notification → Email notification**

Sem isso, o form existe no HTML mas nenhum email é disparado.