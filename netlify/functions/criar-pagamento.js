/*
 * NETLIFY FUNCTION: criar-pagamento.js
 * (Esta versão já está correta, apenas recebe o frete e cobra)
 */

const { MercadoPagoConfig, Preference } = require('mercadopago');

exports.handler = async (event) => {
    
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: JSON.stringify({ error: 'Apenas o método POST é permitido' }) };
    }

    try {
        const MERCADO_PAGO_TOKEN = process.env.MP_ACCESS_TOKEN_PROD;
        const SEU_SITE_URL = process.env.SITE_URL; 

        if (!MERCADO_PAGO_TOKEN || !SEU_SITE_URL) {
            console.error("Variáveis de ambiente (MP_ACCESS_TOKEN_PROD ou SITE_URL) não definidas.");
            return { statusCode: 500, body: JSON.stringify({ error: 'Erro de configuração do servidor.' }) };
        }

        // Recebe os itens e o FRETE CALCULADO (que veio dos Correios)
        const { items, frete } = JSON.parse(event.body);
        if (!items || items.length === 0) {
            return { statusCode: 400, body: JSON.stringify({ error: 'O carrinho está vazio.' }) };
        }
        
        if (typeof frete === 'undefined' || frete < 0) {
             return { statusCode: 400, body: JSON.stringify({ error: 'Valor de frete inválido.' }) };
        }

        const client = new MercadoPagoConfig({ 
            accessToken: MERCADO_PAGO_TOKEN 
        });
        const preferenceClient = new Preference(client);

        const preferenceBody = {
            items: items, 
            back_urls: {
                success: `${SEU_SITE_URL}/sucesso.html`,
                failure: `${SEU_SITE_URL}/falha.html`,
                pending: `${SEU_SITE_URL}/pendente.html`
            },
            auto_return: "approved",
            
            // Adiciona o frete dos Correios e pede o endereço
            shipments: {
                mode: 'not_specified', 
                cost: frete 
            }
        };

        const response = await preferenceClient.create({ body: preferenceBody });

        return {
            statusCode: 200,
            body: JSON.stringify({ 
                redirectUrl: response.init_point 
            })
        };

    } catch (error) {
        console.error('Erro ao criar preferência no Mercado Pago:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ 
                error: 'Erro ao criar pagamento', 
                details: error.message 
            })
        };
    }
};