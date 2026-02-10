/*
 * NETLIFY FUNCTION: webhook-mercadopago.js (Versão 3.1 - Controle de Estoque + Endereço Completo)
 * Recebe o webhook, envia e-mail para o dono E dá baixa no estoque do Supabase.
 */

const { MercadoPagoConfig, Payment } = require('mercadopago');
const fetch = require('node-fetch');
const querystring = require('querystring');
const { createClient } = require('@supabase/supabase-js');

// Função principal
exports.handler = async (event) => {

    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    // --- 1. Pegar as chaves secretas ---
    const MERCADO_PAGO_TOKEN = process.env.MP_ACCESS_TOKEN_PROD;
    const SITE_URL = process.env.SITE_URL || process.env.SUA_URL;
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

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

            // LOG COMPLETO PARA DEBUG (ver no Netlify Functions → Logs)
            console.log('📦 DADOS COMPLETOS DO PAGAMENTO:');
            console.log(JSON.stringify(paymentDetails, null, 2));

            // --- 4. SÓ EXECUTAR SE O PAGAMENTO FOI APROVADO! ---
            if (paymentDetails.status === 'approved') {

                const itemsVendidos = paymentDetails.additional_info?.items || [];
                const errosEstoque = [];

                // --- 5. LÓGICA DE BAIXA DE ESTOQUE ---
                if (itemsVendidos.length > 0) {

                    const stockUpdates = itemsVendidos.map(async (item) => {
                        const produtoId = parseInt(item.id);
                        const quantidadeVendida = parseInt(item.quantity);

                        // Validação robusta
                        if (isNaN(produtoId) || isNaN(quantidadeVendida)) {
                            console.error(`ID ou quantidade inválida: ${item.id}, ${item.quantity}`);
                            errosEstoque.push(`${item.title}: ID ou quantidade inválida`);
                            return;
                        }

                        if (produtoId && quantidadeVendida > 0) {
                            const { error: stockError } = await supabaseAdmin
                                .rpc('decrement_stock', {
                                    product_id: produtoId,
                                    quantity_sold: quantidadeVendida
                                });

                            if (stockError) {
                                console.error(`Erro ao atualizar estoque do ID ${produtoId}:`, stockError.message);
                                errosEstoque.push(`${item.title} (ID: ${produtoId}): ${stockError.message}`);
                            } else {
                                console.log(`✅ Estoque do ID ${produtoId} atualizado com sucesso.`);
                            }
                        }
                    });

                    await Promise.all(stockUpdates);
                }
                // --- FIM DO ESTOQUE ---


                // --- 6. MONTAGEM DO E-MAIL ---

                // 🟢 TENTATIVA DE USAR METADATA (DADOS DO FRONTEND) 🟢
                const meta = paymentDetails.metadata || {};

                let emailCorpo = `
                🎉 NOVA VENDA APROVADA!
                ═══════════════════════════════════════
                💰 Valor Total (com frete): R$ ${paymentDetails.transaction_amount}
                📧 Email: ${meta.client_email !== 'Não informado' ? meta.client_email : (paymentDetails.payer?.email || 'Não informado')}
                👤 Nome: ${meta.client_name || paymentDetails.payer?.first_name || ''} ${!meta.client_name ? (paymentDetails.payer?.last_name || '') : ''}
                📱 Telefone: ${meta.client_phone !== 'Não informado' ? meta.client_phone : (paymentDetails.payer?.phone?.number || 'Não informado')}
                🆔 ID da Transação: ${paymentId}
                💳 Pagamento: ${meta.payment_method || 'Mercado Pago'}

                ═══════════════════════════════════════
                🛒 ITENS VENDIDOS:
                `;

                if (itemsVendidos.length > 0) {
                    itemsVendidos.forEach(item => {
                        emailCorpo += `   • ${item.title}\n`;
                        emailCorpo += `     Quantidade: ${item.quantity}\n`;
                        emailCorpo += `     Preço unitário: R$ ${item.unit_price}\n\n`;
                    });
                }

                // Aviso de erros no estoque
                if (errosEstoque.length > 0) {
                    emailCorpo += `\n⚠️ ATENÇÃO - ERROS NO CONTROLE DE ESTOQUE:\n`;
                    errosEstoque.forEach(erro => {
                        emailCorpo += `   • ${erro}\n`;
                    });
                }

                emailCorpo += `\n═══════════════════════════════════════\n`;
                emailCorpo += `📍 INFORMAÇÕES DE ENTREGA:\n\n`;

                // BUSCA O ENDEREÇO EM TODOS OS LOCAIS POSSÍVEIS
                let enderecoEncontrado = false;
                let addr = null;

                // 🟢 Prioridade 0: METADATA DO SITE (Mais confiável)
                if (meta.client_address) {
                    emailCorpo += `📦 Destinatário: ${meta.client_name || 'Não informado'}\n`;
                    emailCorpo += `🏠 Endereço Completo: ${meta.client_address}\n`;
                    if (meta.client_complement) emailCorpo += `📝 Complemento: ${meta.client_complement}\n`;
                    emailCorpo += `ℹ️ (Dados fornecidos diretamente na loja)\n`;

                    // Marcamos como encontrado para pular os outros checks se quiser, 
                    // mas deixarei o flag false para que o bloco 'if (enderecoEncontrado)' abaixo não duplique 
                    // ou podemos apenas setar uma var para pular o bloco padrão.
                    // Vamos fazer assim: se achou metadata, já escrevemos acima e ignoramos o resto.
                    enderecoEncontrado = false; // Já escrevemos, não precisa do bloco padrão.
                }
                // Prioridade 1: shipments direto (mais comum com mode: 'custom')
                else if (paymentDetails.shipments?.receiver_address) {
                    addr = paymentDetails.shipments.receiver_address;
                    enderecoEncontrado = true;
                    console.log('✅ Endereço encontrado em: shipments.receiver_address');
                }
                // Prioridade 2: additional_info.shipments
                else if (paymentDetails.additional_info?.shipments?.receiver_address) {
                    addr = paymentDetails.additional_info.shipments.receiver_address;
                    enderecoEncontrado = true;
                    console.log('✅ Endereço encontrado em: additional_info.shipments');
                }
                // Prioridade 3: order.shipments
                else if (paymentDetails.order?.shipments?.length > 0) {
                    addr = paymentDetails.order.shipments[0].receiver_address;
                    enderecoEncontrado = true;
                    console.log('✅ Endereço encontrado em: order.shipments');
                }
                // Prioridade 4: payer.address
                else if (paymentDetails.payer?.address) {
                    addr = paymentDetails.payer.address;
                    enderecoEncontrado = true;
                    console.log('✅ Endereço encontrado em: payer.address');
                }

                if (enderecoEncontrado && addr) {
                    emailCorpo += `📦 Destinatário: ${addr.receiver_name || paymentDetails.payer?.first_name || 'Não informado'}\n`;
                    emailCorpo += `🏠 Endereço: ${addr.street_name || ''}, ${addr.street_number || 'S/N'}\n`;

                    // Apartamento/Casa
                    if (addr.floor || addr.apartment) {
                        emailCorpo += `🚪 Apto/Casa: ${addr.floor || ''} ${addr.apartment || ''}\n`;
                    }

                    emailCorpo += `🏘️ Bairro: ${addr.neighborhood?.name || addr.neighborhood || 'Não informado'}\n`;
                    emailCorpo += `🌆 Cidade: ${addr.city?.name || addr.city_name || 'Não informado'}\n`;
                    emailCorpo += `🗺️ Estado: ${addr.state?.name || addr.state_name || 'Não informado'}\n`;
                    emailCorpo += `📮 CEP: ${addr.zip_code || 'Não informado'}\n`;

                    // Complemento/Observações
                    if (addr.comment) {
                        emailCorpo += `📝 Complemento: ${addr.comment}\n`;
                    }
                } else {
                    console.error('❌ ENDEREÇO NÃO ENCONTRADO EM NENHUM LOCAL!');
                    emailCorpo += `⚠️ ATENÇÃO: O ENDEREÇO NÃO FOI INFORMADO!\n\n`;
                    emailCorpo += `Possíveis motivos:\n`;
                    emailCorpo += `• O comprador não preencheu o endereço no checkout\n`;
                    emailCorpo += `• Problema na configuração do Mercado Pago\n`;
                    emailCorpo += `• O frete não foi ativado corretamente\n\n`;
                    emailCorpo += `👉 Acesse: https://www.mercadopago.com.br/activities/${paymentId}\n`;
                }

                emailCorpo += `\n═══════════════════════════════════════\n`;
                emailCorpo += `🔗 Ver no Mercado Pago: https://www.mercadopago.com.br/activities/${paymentId}\n`;

                // --- 7. ENVIAR E-MAIL VIA NETLIFY FORMS ---
                // Fallback para URL do site se não estiver definida
                const TARGET_URL = SITE_URL || process.env.URL || 'https://sccosplay.com.br'; // Ajuste para sua URL real se necessário

                const formData = {
                    'form-name': 'vendas',
                    'assunto': `🎉 Nova Venda #${paymentId} - R$ ${paymentDetails.transaction_amount}`,
                    'detalhes': emailCorpo,
                };

                console.log(`📨 Enviando e-mail para: ${TARGET_URL} (Form: vendas)`);

                try {
                    const emailResponse = await fetch(TARGET_URL, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                        body: querystring.stringify(formData),
                    });

                    if (emailResponse.ok) {
                        console.log('✅ Email enviado com sucesso para o Netlify Forms!');
                    } else {
                        console.error(`❌ Erro ao enviar email: ${emailResponse.status} ${emailResponse.statusText}`);
                        // Tentar logar o corpo da resposta se possível
                        try {
                            const text = await emailResponse.text();
                            console.error('Detalhes do erro de email:', text);
                        } catch (e) { }
                    }
                } catch (fetchError) {
                    console.error('❌ Exceção ao tentar enviar email:', fetchError);
                }

                console.log('✅ Email enviado com sucesso!');
            }
        }

        // 8. Responder 200 OK para o Mercado Pago
        return { statusCode: 200, body: 'Notificação recebida com sucesso.' };

    } catch (error) {
        console.error('❌ Erro no webhook:', error);
        return { statusCode: 500, body: 'Erro interno no processamento do webhook.' };
    }
};