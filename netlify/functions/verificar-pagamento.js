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

    try {
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
    } catch (error) {
        console.error('Erro ao verificar pagamento:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Erro interno ao verificar pagamento' })
        };
    }
};
