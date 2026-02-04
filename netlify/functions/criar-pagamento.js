/*
 * NETLIFY FUNCTION: criar-pagamento.js
 * Versão 5.0 - Limpeza Radical de Strings e Números
 */

const { MercadoPagoConfig, Preference } = require('mercadopago');

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: JSON.stringify({ error: 'Método não permitido' }) };
    }

    try {
        const MERCADO_PAGO_TOKEN = process.env.MP_ACCESS_TOKEN_PROD;
        const host = event.headers.host;
        const protocol = event.headers['x-forwarded-proto'] || 'https';
        const BASE_URL = host ? `${protocol}://${host}` : "https://sccosplay.com.br";

        if (!MERCADO_PAGO_TOKEN) {
            return { statusCode: 500, body: JSON.stringify({ error: 'Token não configurado.' }) };
        }

        const body = JSON.parse(event.body);
        const { items, frete } = body;

        const client = new MercadoPagoConfig({ accessToken: MERCADO_PAGO_TOKEN });
        const preferenceClient = new Preference(client);

        // 1. Limpeza Radical dos Itens
        const itemsFormatados = items.map(item => {
            // Garante que o título não seja gigante e não tenha caracteres estranhos
            const tituloLimpo = String(item.title).substring(0, 50).replace(/[^\w\s]/gi, '');
            
            return {
                title: tituloLimpo || "Produto SCCosplay",
                quantity: parseInt(item.quantity) || 1,
                // Força 2 casas decimais e garante que é positivo
                unit_price: Math.round(Math.abs(Number(item.unit_price)) * 100) / 100,
                currency_id: 'BRL'
            };
        });

        // 2. Limpeza do Frete
        const custoFrete = Math.round(Math.abs(Number(frete)) * 100) / 100;
        const freteFinal = isNaN(custoFrete) ? 0 : custoFrete;

        const preferenceBody = {
            items: itemsFormatados,
            back_urls: {
                success: `${BASE_URL}/sucesso.html`,
                failure: `${BASE_URL}/falha.html`,
                pending: `${BASE_URL}/pendente.html`
            },
            auto_return: "approved",
            shipments: {
                mode: 'custom',
                cost: freteFinal
            }
        };

        console.log("DEBUG FINAL - Payload:", JSON.stringify(preferenceBody));

        const response = await preferenceClient.create({ body: preferenceBody });

        return {
            statusCode: 200,
            body: JSON.stringify({ redirectUrl: response.init_point })
        };

    } catch (error) {
        console.error('ERRO CRÍTICO MP:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ 
                error: 'Erro ao gerar link', 
                details: error.message 
            })
        };
    }
};