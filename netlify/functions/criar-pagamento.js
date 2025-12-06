/*
 * NETLIFY FUNCTION: criar-pagamento.js
 * (Versão 3.1 - FORÇA coleta de endereço)
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
            
            // ========================================
            // CONFIGURAÇÃO COMPLETA DE FRETE/ENDEREÇO
            // ========================================
            shipments: {
                mode: 'custom', // ← MUDOU AQUI! Isso FORÇA o endereço
                cost: frete,
                receiver_address: {
                    zip_code: "", // Deixa vazio para o comprador preencher
                    street_name: "",
                    street_number: ""
                }
            },
            
            // ========================================
            // FORÇA A COLETA DE DADOS DO COMPRADOR
            // ========================================
            payer: {
                name: "",
                surname: "",
                email: "",
                phone: {
                    area_code: "",
                    number: ""
                },
                address: {
                    zip_code: "",
                    street_name: "",
                    street_number: ""
                }
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