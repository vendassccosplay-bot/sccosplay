/*
 * NETLIFY FUNCTION: criar-pagamento.js
 * Versão 5.1 - Diagnóstico e Robustez
 */

const { MercadoPagoConfig, Preference } = require('mercadopago');

exports.handler = async (event) => {
    // Cabeçalhos CORS para permitir requisições locais e de produção
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, headers, body: JSON.stringify({ error: 'Método não permitido' }) };
    }

    try {
        const MERCADO_PAGO_TOKEN = process.env.MP_ACCESS_TOKEN_PROD;

        if (!MERCADO_PAGO_TOKEN) {
            console.error("ERRO: Token MP_ACCESS_TOKEN_PROD não encontrado no ambiente.");
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ error: 'Token do Mercado Pago não configurado no servidor.' })
            };
        }

        const body = JSON.parse(event.body);
        const { items, frete, metadata } = body; // 🟢 Recebendo metadata do frontend

        console.log(`Iniciando criação de preferência para ${items.length} itens. Frete: ${frete}`);

        const client = new MercadoPagoConfig({
            accessToken: MERCADO_PAGO_TOKEN,
            options: { timeout: 5000 }
        });
        const preferenceClient = new Preference(client);

        // 1. Limpeza e Validação dos Itens
        const itemsFormatados = items.map((item, index) => {
            const title = String(item.title).substring(0, 250).trim() || "Produto Indefinido";
            let unitPrice = Number(item.unit_price);
            let quantity = parseInt(item.quantity, 10);

            if (isNaN(unitPrice) || unitPrice <= 0) {
                throw new Error(`Item ${index + 1} (${title}) tem preço inválido: ${item.unit_price}`);
            }
            if (isNaN(quantity) || quantity <= 0) {
                quantity = 1;
            }

            return {
                title: title,
                quantity: quantity,
                unit_price: Number(unitPrice.toFixed(2)),
                currency_id: 'BRL'
            };
        });

        // 2. Limpeza do Frete e Adição como Item
        let custoFrete = Number(frete);
        if (!isNaN(custoFrete) && custoFrete > 0) {
            itemsFormatados.push({
                title: "Frete e Envio",
                quantity: 1,
                unit_price: Number(custoFrete.toFixed(2)),
                currency_id: 'BRL'
            });
        }

        const host = event.headers.host;
        const xForwardedProto = event.headers['x-forwarded-proto'];
        // Forçar HTTPS se não for localhost
        const protocol = (host.includes('localhost') || host.includes('127.0.0.1')) ? 'http' : 'https';

        // Fallback robusto para URL
        const BASE_URL = host ? `${protocol}://${host}` : "https://sccosplay.com.br";

        console.log(`[DEBUG] Construindo back_urls com BASE_URL: ${BASE_URL} (Proto: ${protocol}, Host: ${host})`);

        const preferenceBody = {
            items: itemsFormatados,
            back_urls: {
                success: `${BASE_URL}/sucesso.html`,
                failure: `${BASE_URL}/falha.html`,
                pending: `${BASE_URL}/pendente.html`
            },
            auto_return: "approved",
            // 🟢 Passando metadata para o Webhook
            metadata: metadata || {},
            statement_descriptor: "SC COSPLAY",
            external_reference: `ORDER-${Date.now()}`
        };

        console.log("Enviando Payload para Mercado Pago:", JSON.stringify(preferenceBody, null, 2));

        const response = await preferenceClient.create({ body: preferenceBody });

        console.log("Preferência Criada com Sucesso. ID:", response.id);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                redirectUrl: response.init_point,
                preferenceId: response.id // Retornando também o ID para debug se necessário
            })
        };

    } catch (error) {
        console.error('ERRO CRÍTICO NO BACKEND:', error);

        // Tenta extrair mensagem de erro detalhada da API do MP
        const errorMessage = error.cause?.description || error.message || "Erro desconhecido";

        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                error: 'Falha ao criar link de pagamento',
                details: errorMessage
            })
        };
    }
};