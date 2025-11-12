/*
 * NETLIFY FUNCTION: calcular-frete.js
 * Versão 4.0 - Integrado com MELHOR ENVIO (Mais estável)
 */

// 1. Importar o node-fetch
const fetch = require('node-fetch');

// 2. Configurações da sua loja (CEP de Origem)
const CEP_ORIGEM = '01022000'; // Ladeira Porto Geral (sem traço)

exports.handler = async (event) => {
    
    // 3. Só aceitar POST
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        // 4. Pegar as chaves secretas da Netlify
        const MELHOR_ENVIO_TOKEN = process.env.MELHOR_ENVIO_TOKEN;
        if (!MELHOR_ENVIO_TOKEN) {
            console.error("Token do Melhor Envio não configurado.");
            return { statusCode: 500, body: JSON.stringify({ error: 'Erro de configuração do servidor de frete.' }) };
        }

        // 5. Pegar o CEP do cliente e os itens do carrinho
        const { cepDestino, items } = JSON.parse(event.body);
        if (!cepDestino || !items || items.length === 0) {
            return { statusCode: 400, body: 'CEP ou itens do carrinho não fornecidos.' };
        }

        // 6. Calcular o peso total (Melhor Envio usa KG)
        let pesoTotal = 0;
        items.forEach(item => {
            const pesoItem = parseFloat(item.peso || 0.5); // 0.5kg (500g) como padrão
            pesoTotal += pesoItem;
        });
        if (pesoTotal < 0.3) pesoTotal = 0.3; // Mínimo

        // 7. Montar o pacote de envio para o Melhor Envio
        // (Vamos usar os Correios (PAC/SEDEX) e o Mini Envios deles)
        const bodyCalculo = {
            "from": { "postal_code": CEP_ORIGEM },
            "to": { "postal_code": cepDestino.replace(/\D/g, '') },
            "package": {
                // O Melhor Envio só precisa do peso para PAC/SEDEX/Mini
                "weight": String(pesoTotal), 
                // NOTA: Para transportadoras (Jadlog, etc), precisaríamos das dimensões
                // "width": 20,
                // "height": 20,
                // "length": 20,
            },
            "services": "1,2,17" // 1=PAC, 2=SEDEX, 17=Mini Envios (só para pacotes pequenos)
        };

        // 8. Chamar a API do Melhor Envio (em modo SANDBOX para teste)
        // ATENÇÃO: Troque 'sandbox' por 'www' para produção real
        const response = await fetch('https://www.melhorenvio.com.br/api/v2/me/shipment/calculate', {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${MELHOR_ENVIO_TOKEN}`,
                'User-Agent': 'SC Cosplay (contato@sccosplay.com.br)'
            },
            body: JSON.stringify(bodyCalculo)
        });

        if (!response.ok) {
            const erro = await response.json();
            console.error('Erro Melhor Envio:', erro);
            return { statusCode: response.status, body: JSON.stringify({ error: erro.message || "Não foi possível calcular o frete." }) };
        }

        const data = await response.json();
        
        // 9. Filtrar os resultados para achar o mais barato
        let freteMaisBarato = null;
        for (const frete of data) {
            // Ignora se deu erro ou se não tem preço
            if (frete.error || !frete.price) {
                continue;
            }
            
            // Converte o preço (que é uma string "20.50") para número
            const preco = parseFloat(frete.price);

            if (!freteMaisBarato || preco < freteMaisBarato.valor) {
                freteMaisBarato = {
                    servico: frete.name, // Ex: "PAC" ou ".Mini Envios"
                    valor: preco,
                    prazo: frete.delivery_time
                };
            }
        }

        if (!freteMaisBarato) {
             return { statusCode: 400, body: JSON.stringify({ error: "Nenhuma transportadora disponível para este CEP." }) };
        }
        
        // 10. Sucesso! Enviar o frete mais barato de volta para o frontend
        return {
            statusCode: 200,
            body: JSON.stringify(freteMaisBarato)
        };

    } catch (error) {
        console.error('Erro fatal ao calcular frete:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Erro no servidor de frete.' })
        };
    }
};