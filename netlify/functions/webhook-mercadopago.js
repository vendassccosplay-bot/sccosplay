/*
 * NETLIFY FUNCTION: webhook-mercadopago.js (Versão 3.0 - Controle de Estoque)
 * Recebe o webhook, envia e-mail para o dono E dá baixa no estoque do Supabase.
 */

const { MercadoPagoConfig, Payment } = require('mercadopago');
const fetch = require('node-fetch');
const querystring = require('querystring'); 
const { createClient } = require('@supabase/supabase-js'); // <--- NOVO

// Função principal
exports.handler = async (event) => {
    
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    // --- 1. Pegar as chaves secretas ---
    const MERCADO_PAGO_TOKEN = process.env.MP_ACCESS_TOKEN_PROD;
    const SITE_URL = process.env.SITE_URL; 
    const SUPABASE_URL = process.env.SUPABASE_URL; // <--- NOVO
    const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY; // <--- NOVO

    if (!MERCADO_PAGO_TOKEN || !SITE_URL || !SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
        console.error("Erro: Variáveis de ambiente não definidas (MP, SITE_URL, ou Supabase).");
        return { statusCode: 500, body: 'Erro de configuração do servidor.' };
    }

    // --- 2. Conectar ao Supabase com permissão de ADMIN ---
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    try {
        const body = JSON.parse(event.body);

        if (body.type === 'payment' && body.data && body.data.id) {
            
            const paymentId = body.data.id;

            // --- 3. Buscar os detalhes do pagamento no Mercado Pago ---
            const client = new MercadoPagoConfig({ accessToken: MERCADO_PAGO_TOKEN });
            const paymentClient = new Payment(client);
            const paymentDetails = await paymentClient.get({ id: paymentId });

            // --- 4. SÓ EXECUTAR SE O PAGAMENTO FOI APROVADO! ---
            if (paymentDetails.status === 'approved') {
                
                let emailCorpo = `...`; // (O código do e-mail vai aqui embaixo)
                const itemsVendidos = paymentDetails.additional_info?.items;

                // --- 5. LÓGICA DE BAIXA DE ESTOQUE ---
                if (itemsVendidos && itemsVendidos.length > 0) {
                    
                    // Usamos Promise.all para rodar todas as atualizações de estoque
                    const stockUpdates = itemsVendidos.map(async (item) => {
                        // O 'item.id' foi o que enviamos do script.js
                        const produtoId = parseInt(item.id); 
                        const quantidadeVendida = parseInt(item.quantity);

                        if (produtoId && quantidadeVendida > 0) {
                            // Chama a função 'decrement_stock' no Supabase
                            const { error: stockError } = await supabaseAdmin
                                .rpc('decrement_stock', { 
                                    product_id: produtoId, 
                                    quantity_sold: quantidadeVendida 
                                });
                            
                            if (stockError) {
                                console.error(`Erro ao atualizar estoque do ID ${produtoId}:`, stockError.message);
                                // Não para o processo, só registra o erro
                            } else {
                                console.log(`Estoque do ID ${produtoId} atualizado com sucesso.`);
                            }
                        }
                    });
                    
                    await Promise.all(stockUpdates); // Espera o estoque atualizar
                }
                // --- FIM DO ESTOQUE ---


                // --- 6. LÓGICA DE E-MAIL (Igual a antes) ---
                emailCorpo = `
Você recebeu uma nova venda!
---------------------------------
Status: ${paymentDetails.status}
Valor Total (com frete): R$ ${paymentDetails.transaction_amount}
Pagador: ${paymentDetails.payer.email}
ID da Transação: ${paymentId}
---------------------------------
Itens:
`;
                if (itemsVendidos) {
                    itemsVendidos.forEach(item => {
                        emailCorpo += `- ${item.title} (Qtd: ${item.quantity}) - R$ ${item.unit_price}\n`;
                    });
                }

                emailCorpo += "\n---------------------------------\n";
                emailCorpo += "INFORMAÇÕES DE ENTREGA (Preenchidas no MP):\n";
                
                const addr = paymentDetails.additional_info?.shipments?.receiver_address;
                
                if (addr) {
                    emailCorpo += `Rua: ${addr.street_name || ''}, ${addr.street_number || ''}\n`;
                    emailCorpo += `Bairro: ${addr.neighborhood?.name || '(Não informado)'}\n`;
                    emailCorpo += `Cidade: ${addr.city?.name || ''} - ${addr.state?.name || ''}\n`;
                    emailCorpo += `CEP: ${addr.zip_code || ''}\n`;
                    emailCorpo += `Complemento: ${addr.comment || '(Nenhum)'}\n`;
                } else {
                    emailCorpo += "Endereço não informado.\n";
                }
                
                const formData = {
                    'form-name': 'vendas',
                    'assunto': `Nova Venda Aprovada! Pedido #${paymentId}`,
                    'detalhes': emailCorpo,
                };

                await fetch(SITE_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: querystring.stringify(formData),
                });
            }
        }

        // 7. Responder 200 OK para o Mercado Pago
        return { statusCode: 200, body: 'Notificação recebida com sucesso.' };

    } catch (error) {
        console.error('Erro no webhook:', error);
        return { statusCode: 500, body: 'Erro interno no processamento do webhook.' };
    }
};