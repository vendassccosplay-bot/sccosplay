/*
 * SC COSPLAY - SCRIPT PRINCIPAL (MODIFICADO PARA WHATSAPP)
 * Versão: 10.3 - Integração WhatsApp Checkout
 */
document.addEventListener('DOMContentLoaded', () => {

    // --- 🟢 CONFIGURAÇÃO DO WHATSAPP (ADICIONE AQUI!) ---
    const WHATSAPP_NUMERO = "551132285469"; // ⚠️ MUDE PARA O NÚMERO REAL DA EMPRESA

    // --- 1. CONFIGURAÇÃO DO SUPABASE ---
    const SUPABASE_URL = 'https://epfdigzbupmoyzlydmsu.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVwZmRpZ3pidXBtb3l6bHlkbXN1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEwODU5MTIsImV4cCI6MjA3NjY2MTkxMn0.bkAtuLh9bU3tvk1PQ4wmrUiv0tn-ygEZQsmlqH-fZOc';
    let supabaseClient;

    // --- 2. ESTADO DA APLICAÇÃO ---
    let allProducts = [];
    let currentFilteredProducts = [];
    let currentPage = 1;
    const productsPerPage = 8;
    let cart = [];
    let favorites = [];
    let freteCalculado = 0;
    let freteServico = '';
    let isCalculatingFrete = false;
    let isShowingFavorites = false;

    // --- 3. SELETORES DO DOM ---
    const rootElement = document.documentElement;
    const promoBanner = document.querySelector('.promo-banner');
    const mainHeader = document.querySelector('.main-header');
    const cartIcon = document.getElementById('cart-icon');
    const cartCount = document.getElementById('cart-count');
    const productGrid = document.getElementById('product-grid');
    const productSection = document.getElementById('product-section');
    const productGridWrapper = document.getElementById('product-grid-wrapper');
    const loadMoreContainer = document.getElementById('load-more-container');
    const loadMoreBtn = document.getElementById('load-more-btn');
    const paginacaoContainer = document.getElementById('paginacao');
    const headerSearchInput = document.getElementById('header-search-input');
    const headerSearchBtn = document.getElementById('header-search-btn');
    const sectionSearchInput = document.getElementById('section-search-input');
    const sectionSearchBtn = document.getElementById('section-search-btn');
    const categoryFilters = document.getElementById('category-filters');
    const sortFilter = document.getElementById('sort-filter');
    const notificationContainer = document.getElementById('notification-container');
    const cartModalOverlay = document.getElementById('cart-modal-overlay');
    const productModalOverlay = document.getElementById('product-modal-overlay');
    const deliveryModalOverlay = document.getElementById('delivery-modal-overlay');
    const deliveryForm = document.getElementById('delivery-form');
    const closeDeliveryModalBtn = document.getElementById('close-delivery-modal-btn');
    const cepInput = document.getElementById('client-cep');
    const cepStatus = document.getElementById('cep-status');
    const cepSpinner = document.getElementById('cep-spinner');
    const addressInput = document.getElementById('client-address');
    const numberInput = document.getElementById('client-number');
    const bairroInput = document.getElementById('client-bairro');
    const cidadeInput = document.getElementById('client-cidade');
    const ufInput = document.getElementById('client-uf');
    const favoritesIcon = document.getElementById('favorites-icon');
    const accountIcon = document.getElementById('account-icon');
    const freteInfoBox = document.getElementById('frete-info-box');
    const freteInfoText = document.getElementById('frete-info-text');
    const heroTag = document.getElementById('hero-tag');
    const heroTitle = document.getElementById('hero-title');
    const heroSubtitle = document.getElementById('hero-subtitle');
    const heroBtnPrimary = document.getElementById('hero-btn-primary');
    const heroBtnSecondary = document.getElementById('hero-btn-secondary');
    const heroImage = document.getElementById('hero-image');

    // --- 4. FUNÇÕES DE BUSCA DE DADOS (SUPABASE) ---
    async function loadHeroAndTheme() {
        if (!supabaseClient) return;
        console.log("Buscando conteúdo do Hero e Tema...");
        try {
            const { data, error, status } = await supabaseClient.from('hero_config').select('*').eq('is_active', true).limit(1).single();
            if (error) {
                console.error(`Erro ao buscar Hero/Tema [${status}]:`, error.message);
                if (heroTag) heroTag.textContent = 'Novidades';
                if (heroTitle) heroTitle.textContent = 'Bem-vindo!';
                if (heroSubtitle) heroSubtitle.textContent = 'Confira nossos produtos.';
                if (heroBtnPrimary) heroBtnPrimary.textContent = 'Ver Produtos';
                if (heroImage && (!heroImage.src || heroImage.src === window.location.href)) heroImage.src = 'img/hero-main-image.jpg';
                return;
            }
            if (data) {
                console.log("Tema e Hero carregados:", data.tag);
                if (heroTag) heroTag.innerHTML = `<i class="fas fa-star"></i> ${data.tag || ''}`;
                if (heroTitle) heroTitle.innerHTML = data.titulo || 'Título Padrão';
                if (heroSubtitle) heroSubtitle.textContent = data.subtitulo || '';
                if (heroBtnPrimary) heroBtnPrimary.innerHTML = `${data.btn_primario_texto || 'Ver'} <i class="fas fa-arrow-right"></i>`;
                if (heroBtnSecondary) heroBtnSecondary.textContent = data.btn_secundario_texto || 'Categorias';
                if (heroImage) {
                    heroImage.src = data.imagem_url || 'img/hero-main-image.jpg';
                    heroImage.alt = data.tag || 'Campanha Atual';
                }
                if (data.primary_color) rootElement.style.setProperty('--color-primary-purple', data.primary_color);
                if (data.secondary_color) rootElement.style.setProperty('--color-secondary-pink', data.secondary_color);
                if (data.gradient_primary) rootElement.style.setProperty('--gradient-primary', data.gradient_primary);
                if (data.footer_bg) rootElement.style.setProperty('--color-footer-bg', data.footer_bg);
                if (data.color_highlight_pink) rootElement.style.setProperty('--color-highlight-pink', data.color_highlight_pink);
                if (data.color_highlight_green) rootElement.style.setProperty('--color-highlight-green', data.color_highlight_green);
            }
        } catch (err) { console.error("Erro na função loadHeroAndTheme:", err); }
    }

    async function fetchProducts() {
        if (!supabaseClient) throw new Error("Cliente Supabase não inicializado.");
        console.log("Buscando produtos...");
        try {
            let { data, error, status } = await supabaseClient
                .from('products')
                .select('id, name, price, stock, rating, description, category, image, peso, altura, largura, comprimento, galeria, variacoes')
                .order('id', { ascending: true });

            if (error) {
                console.error(`Erro Supabase [${status}]:`, error.message);
                throw new Error(`Erro ao buscar produtos (${status}).`);
            }
            console.log("Produtos carregados (com dimensões e galeria):", data);
            return data || [];
        } catch (err) { console.error("Erro fetchProducts:", err); throw err; }
    }

    // --- 5. FUNÇÕES DE PRODUTO E FILTRO ---
    function filterAndSortProducts() {
        if (!categoryFilters || !sortFilter || !productGrid) return;
        const headerTerm = headerSearchInput ? headerSearchInput.value.toLowerCase() : '';
        const sectionTerm = sectionSearchInput ? sectionSearchInput.value.toLowerCase() : '';
        const searchTerm = sectionTerm || headerTerm;
        const activeCategoryButton = categoryFilters.querySelector('.category-btn.active');
        const activeCategory = activeCategoryButton ? activeCategoryButton.dataset.category : 'all';
        const sortBy = sortFilter.value;

        let filteredProducts = [...allProducts];

        if (activeCategory !== 'all') {
            filteredProducts = filteredProducts.filter(p => p.category === activeCategory);
        }
        if (searchTerm) {
            filteredProducts = filteredProducts.filter(p => p.name && p.name.toLowerCase().includes(searchTerm));
        }
        switch (sortBy) {
            case 'price-asc': filteredProducts.sort((a, b) => (a.price || 0) - (b.price || 0)); break;
            case 'price-desc': filteredProducts.sort((a, b) => (b.price || 0) - (a.price || 0)); break;
        }

        if (isShowingFavorites) {
            filteredProducts = filteredProducts.filter(p => favorites.includes(p.id));
        }

        currentFilteredProducts = filteredProducts;
        currentPage = 1;

        if (paginacaoContainer) {
            paginacaoContainer.classList.remove('visible');
        }

        productGridWrapper.classList.remove('expanded');

        const pageProducts = currentFilteredProducts.slice(0, productsPerPage);
        renderProducts(pageProducts);

        if (currentFilteredProducts.length <= productsPerPage) {
            productGridWrapper.classList.add('expanded');
            if (loadMoreContainer) {
                loadMoreContainer.style.display = 'none';
            }
        } else {
            productGridWrapper.classList.remove('expanded');
            if (loadMoreContainer) {
                loadMoreContainer.style.display = 'flex';
            }
        }
    }

    function renderProducts(productsToRender) {
        if (!productGrid) return;
        productGrid.innerHTML = '';
        if (productsToRender.length === 0) {
            if (isShowingFavorites) {
                productGrid.innerHTML = '<p style="text-align:center; color:#888; grid-column: 1 / -1;">Você ainda não favoritou nenhum produto.</p>';
            } else {
                productGrid.innerHTML = '<p style="text-align:center; color:#888; grid-column: 1 / -1;">Nenhuma fantasia encontrada.</p>';
            }
        }

        productsToRender.forEach(product => {
            const isSoldOut = !product.stock || product.stock <= 0;
            const isFavorite = favorites.includes(product.id);
            const card = document.createElement('div');
            card.className = 'product-card fade-in-element'; card.dataset.id = product.id;
            const productName = product.name || '?';
            const productImage = product.image || 'img/placeholder.png';
            const productPrice = (product.price || 0).toFixed(2).replace('.', ',');
            const productRating = product.rating || 0;
            const availableSizes = ['P', 'M', 'G', 'G1', 'G2', 'G3'];
            const sizeBadgesHTML = availableSizes.map(size => `<span class="size-badge">${size}</span>`).join('');

            const ratingStarsHTML = Array(5).fill(0).map((_, i) => `<i class="${i < Math.round(productRating) ? 'fas' : 'far'} fa-star"></i>`).join('');
            const ratingNumberHTML = productRating > 0 ? `<span class="rating-number">${productRating.toFixed(1)}</span>` : '';

            card.innerHTML = `
                <div class="product-image-wrapper">
                    <img src="${productImage}" alt="${productName}" class="product-image" loading="lazy" width="300" height="300">
                    <button class="product-favorite ${isFavorite ? 'active' : ''}" data-id="${product.id}" aria-label="Adicionar aos Favoritos"> <i class="${isFavorite ? 'fas' : 'far'} fa-heart"></i> </button>
                    ${isSoldOut ? '<span class="sold-out-tag">Esgotado</span>' : ''}
                </div>
                <div class="product-info">
                    <h3 class="product-name">${productName}</h3>
                    <div class="product-rating">
                        ${ratingStarsHTML}
                        ${ratingNumberHTML}
                    </div>
                    <div class="product-sizes">${sizeBadgesHTML}</div>
                    <p class="product-price">R$ ${productPrice}</p>
                    <button class="add-button" ${isSoldOut ? 'disabled' : ''} data-id="${product.id}"> ${isSoldOut ? 'Esgotado' : '<i class="fas fa-cart-plus" style="margin-right: 5px;"></i> Adicionar'} </button>
                </div>`;
            const img = card.querySelector('img'); if (img) img.onerror = () => { img.src = 'img/placeholder.png'; };
            productGrid.appendChild(card);
        });

        setupScrollAnimations();
    }

    function updateProductDisplay() {
        if (!productGrid) return;

        const inicio = (currentPage - 1) * productsPerPage;
        const fim = inicio + productsPerPage;

        const pageProducts = currentFilteredProducts.slice(inicio, fim);

        renderProducts(pageProducts);
        setupPaginationControls();

        if (productSection) {
            setTimeout(() => {
                productSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 100);
        }
    }

    function setupPaginationControls() {
        if (!paginacaoContainer) return;
        paginacaoContainer.innerHTML = '';

        const totalPaginas = Math.ceil(currentFilteredProducts.length / productsPerPage);
        if (totalPaginas <= 1) return;

        const btnAnterior = document.createElement('a');
        btnAnterior.href = "#";
        btnAnterior.innerHTML = "&lt;";
        btnAnterior.classList.add('arrow-button');
        if (currentPage === 1) {
            btnAnterior.classList.add('disabled');
        }
        btnAnterior.addEventListener('click', (e) => {
            e.preventDefault();
            if (currentPage > 1) {
                currentPage--;
                updateProductDisplay();
            }
        });
        paginacaoContainer.appendChild(btnAnterior);

        let inicio = Math.max(1, currentPage - 2);
        let fim = Math.min(totalPaginas, currentPage + 2);

        if (currentPage <= 2) {
            fim = Math.min(5, totalPaginas);
        }
        if (currentPage >= totalPaginas - 1) {
            inicio = Math.max(1, totalPaginas - 4);
        }

        for (let i = inicio; i <= fim; i++) {
            const btnPagina = document.createElement('a');
            btnPagina.href = "#";
            btnPagina.innerText = i;
            btnPagina.classList.add('pagination-button');

            if (i === currentPage) {
                btnPagina.classList.add('active');
            }

            btnPagina.addEventListener('click', (e) => {
                e.preventDefault();
                currentPage = i;
                updateProductDisplay();
            });
            paginacaoContainer.appendChild(btnPagina);
        }

        const btnSeguinte = document.createElement('a');
        btnSeguinte.href = "#";
        btnSeguinte.innerHTML = "&gt;";
        btnSeguinte.classList.add('arrow-button');
        if (currentPage === totalPaginas) {
            btnSeguinte.classList.add('disabled');
        }
        btnSeguinte.addEventListener('click', (e) => {
            e.preventDefault();
            if (currentPage < totalPaginas) {
                currentPage++;
                updateProductDisplay();
            }
        });
        paginacaoContainer.appendChild(btnSeguinte);
    }

    // --- 6. FUNÇÕES DOS MODAIS ---
    function openProductModal(productId) {
        const product = allProducts.find(p => p.id == productId);
        if (!product || !productModalOverlay) { console.warn(`Produto ${productId} não encontrado.`); return; }
        if (!product.stock || product.stock <= 0) { showNotification("Esgotado!"); return };

        const productName = product.name || '?';
        const productPrice = (product.price || 0).toFixed(2).replace('.', ',');
        const productImage = product.image || 'img/placeholder.png';
        const productDescription = product.description || '';
        const productRating = product.rating || 0;

        const ratingStarsHTML = Array(5).fill(0).map((_, i) => `<i class="${i < Math.round(productRating) ? 'fas' : 'far'} fa-star"></i>`).join('');

        let galleryImages = [productImage];
        if (product.galeria && Array.isArray(product.galeria)) {
            galleryImages = galleryImages.concat(product.galeria);
        }


        // --- LOGIC FOR VARIATIONS (COLORS) ---
        let variationsHTML = '';
        let hasVariations = false;

        if (product.variacoes && Array.isArray(product.variacoes) && product.variacoes.length > 0) {
            hasVariations = true;
            // Tentar identificar os campos (pode ser 'nome', 'cor', 'color' e 'imagem', 'src', 'url')
            variationsHTML = `<div class="color-selector"><h4>Cor:</h4><div class="colors-options" style="display:flex; gap:10px; flex-wrap:wrap;">`;

            product.variacoes.forEach((v, idx) => {
                let vName, vImage;
                if (typeof v === 'string') {
                    vName = v; // Se for apenas string, o nome é a própria string
                    vImage = null;
                } else {
                    vName = v.nome || v.cor || v.name || v.color || `Cor ${idx + 1}`;
                    vImage = v.imagem || v.src || v.url || v.image || null;
                }
                const vId = `color-${product.id}-${idx}`;

                // Se tiver imagem, usamos ela no data-image para troca dinâmica
                const dataImgAttr = vImage ? `data-image="${vImage}"` : '';

                // Criando o radio button
                // Se for a primeira opção, marcamos como checked (opcional, ou deixar vazio para forçar escolha)
                // Vamos deixar vazio para forçar a escolha se quiser, ou checked no primeiro.
                // Padrão: checked no primeiro para facilitar.
                const isChecked = idx === 0 ? 'checked' : '';

                variationsHTML += `
                    <div class="color-option-item">
                        <input type="radio" id="${vId}" name="product-color-${product.id}" value="${vName}" ${dataImgAttr} ${isChecked} style="display:none;">
                        <label for="${vId}" class="color-label" title="${vName}" 
                               style="border:2px solid #ddd; padding:5px 10px; border-radius:4px; cursor:pointer; display:flex; align-items:center; gap:5px;">
                            ${vImage ? `<img src="${vImage}" style="width:20px;height:20px;object-fit:cover;border-radius:50%;">` : ''}
                            <span>${vName}</span>
                        </label>
                    </div>
                 `;
            });
            variationsHTML += `</div></div>`;
        }

        const modalHTML = `
            <div class="modal-content">
                <button class="close-modal-btn" id="dynamic-close-product">&times;</button>
                <div class="modal-body">
                    
                    <div class="modal-image-container">
                        <img src="${productImage}" alt="${productName}" id="modal-product-image" class="carousel-main-image" onerror="this.onerror=null;this.src='img/placeholder.png';">
                        <div class="image-thumbnails">
                            ${galleryImages.map((img, index) => `
                                <img src="${img}" alt="Thumbnail ${index + 1}" class="thumbnail-image" data-index="${index}" onclick="document.getElementById('modal-product-image').src='${img}'" onerror="this.onerror=null;this.src='img/placeholder.png'" />
                            `).join('')}
                        </div>
                    </div>

                    <div class="modal-details-container">
                        <h2 class="modal-product-name">${productName}</h2>
                        
                        <div class="product-rating modal-rating" style="margin-bottom: 15px;">
                            ${ratingStarsHTML}
                            <span class="reviews" style="margin-left: 10px; font-size: 0.8rem;">(${productRating.toFixed(1)} / 5)</span>
                        </div>
                        
                        <p class="modal-product-price">R$ ${productPrice}</p>
                        <p class="modal-product-description">${productDescription}</p>
                        
                        ${variationsHTML} <!-- Inserindo Variações -->

                        <div class="size-selector"><h4>Tamanho:</h4><div class="sizes">
                            <input type="radio" id="size-p-${product.id}" name="product-size-${product.id}" value="P" checked><label for="size-p-${product.id}">P</label>
                            <input type="radio" id="size-m-${product.id}" name="product-size-${product.id}" value="M"><label for="size-m-${product.id}">M</label>
                            <input type="radio" id="size-g-${product.id}" name="product-size-${product.id}" value="G"><label for="size-g-${product.id}">G</label>
                            <input type="radio" id="size-g1-${product.id}" name="product-size-${product.id}" value="G1"><label for="size-g1-${product.id}">G1</label>
                            <input type="radio" id="size-g2-${product.id}" name="product-size-${product.id}" value="G2"><label for="size-g2-${product.id}">G2</label>
                            <input type="radio" id="size-g3-${product.id}" name="product-size-${product.id}" value="G3"><label for="size-g3-${product.id}">G3</label>
                        </div></div>
                        <button class="modal-add-to-cart-btn" id="dynamic-add-to-cart" data-id="${product.id}" data-has-variations="${hasVariations}"><i class="fas fa-cart-plus"></i> Adicionar</button>
                    </div>
                </div>
            </div>`;
        productModalOverlay.innerHTML = modalHTML;
        productModalOverlay.classList.add('active');

        // --- 6.1 Event Listeners para Variações ---
        if (hasVariations) {
            const colorInputs = document.querySelectorAll(`input[name="product-color-${product.id}"]`);
            const mainImg = document.getElementById('modal-product-image');

            // Atualizar estilo visual da seleção (borda colorida, etc)
            const updateSelectionStyle = () => {
                colorInputs.forEach(input => {
                    const label = document.querySelector(`label[for="${input.id}"]`);
                    if (input.checked) {
                        label.style.borderColor = '#9C27B0'; // Cor destaque
                        label.style.backgroundColor = '#f3e5f5';

                        // Trocar imagem se disponível
                        const newImg = input.getAttribute('data-image');
                        if (newImg && newImg !== 'null' && newImg !== 'undefined') {
                            mainImg.src = newImg;
                        }
                    } else {
                        label.style.borderColor = '#ddd';
                        label.style.backgroundColor = 'transparent';
                    }
                });
            };

            colorInputs.forEach(input => {
                input.addEventListener('change', updateSelectionStyle);
            });
            // Inicializar estilo
            updateSelectionStyle();
        }

        const closeBtn = document.getElementById('dynamic-close-product');
        const addBtn = document.getElementById('dynamic-add-to-cart');
        if (closeBtn) closeBtn.addEventListener('click', closeProductModal);
        if (addBtn) {
            addBtn.addEventListener('click', (e) => {
                const id = Number(e.target.dataset.id);
                const hasVars = e.target.dataset.hasVariations === 'true';

                const selectedSizeInput = document.querySelector(`input[name='product-size-${id}']:checked`);
                let selectedColor = null;
                let selectedColorImage = null;

                if (hasVars) {
                    const selectedColorInput = document.querySelector(`input[name='product-color-${id}']:checked`);
                    if (!selectedColorInput) {
                        showNotification("Selecione uma cor!");
                        return;
                    }
                    selectedColor = selectedColorInput.value;
                    selectedColorImage = selectedColorInput.getAttribute('data-image');
                    // Converter string 'null' para null real se necessário
                    if (selectedColorImage === 'null' || selectedColorImage === 'undefined') selectedColorImage = null;
                }

                if (selectedSizeInput) {
                    addToCart(id, selectedSizeInput.value, selectedColor, selectedColorImage);
                    closeProductModal();
                } else {
                    showNotification("Selecione um tamanho!");
                }
            });
        }
    }
    function closeProductModal() { if (productModalOverlay) { productModalOverlay.classList.remove('active'); productModalOverlay.innerHTML = ''; } }

    function openCartModal() {
        if (!cartModalOverlay) return;
        const modalHTML = `
            <div class="cart-modal">
                <div class="cart-modal-header">
                    <h3>Seu Carrinho</h3>
                    <button class="close-modal-btn" id="dynamic-close-cart">&times;</button>
                </div>
                <div class="cart-modal-body" id="cart-items-container"></div>
                <div class="cart-modal-footer">
                    <div class="cart-total"><strong>Total:</strong><span id="cart-total-price">R$ 0,00</span></div>
                    <button class="checkout-btn" id="dynamic-checkout-btn"><i class="fas fa-credit-card"></i> Finalizar Pedido</button>
                </div>
            </div>`;
        cartModalOverlay.innerHTML = modalHTML;
        cartModalOverlay.classList.add('modal-overlay');
        cartModalOverlay.classList.add('active');
        renderCartItems();

        const cBtn = document.getElementById('dynamic-close-cart');
        const oBtn = document.getElementById('dynamic-checkout-btn');
        const wBtn = document.getElementById('dynamic-whatsapp-btn');
        const iCont = document.getElementById('cart-items-container');

        if (cBtn) cBtn.addEventListener('click', closeCartModal);

        if (oBtn) oBtn.addEventListener('click', () => {
            if (cart.length > 0) {
                closeCartModal();
                openDeliveryModal();
            }
        });



        if (iCont) iCont.addEventListener('click', (e) => {
            if (e.target.classList.contains('remove-item-btn')) removeFromCart(Number(e.target.dataset.cartid));
        });
    }


    function closeCartModal() { if (cartModalOverlay) { cartModalOverlay.classList.remove('active'); cartModalOverlay.classList.remove('modal-overlay'); cartModalOverlay.innerHTML = ''; } }

    // --- 7. FUNÇÕES DE LÓGICA DO CARRINHO ---
    function renderCartItems() {
        const cont = document.getElementById('cart-items-container');
        const totEl = document.getElementById('cart-total-price');
        const chkBtn = document.getElementById('dynamic-checkout-btn');
        if (!cont || !totEl || !chkBtn) return;

        cont.innerHTML = '';
        let total = 0;

        if (cart.length === 0) {
            cont.innerHTML = '<p style="text-align:center; color:#888; grid-column: 1 / -1;">Carrinho vazio.</p>';
            chkBtn.disabled = true;
            chkBtn.style.backgroundColor = '#555';
        } else {
            cart.forEach(item => {
                const p = allProducts.find(prod => prod.id == item.id);
                if (!p) return;

                total += (p.price || 0);
                const img = item.colorImage || p.image || 'img/placeholder.png';
                const name = p.name || '?';
                const price = (p.price || 0).toFixed(2).replace('.', ',');
                const size = item.size || '?';
                const colorInfo = item.color ? `<br><small>Cor: ${item.color}</small>` : '';

                cont.innerHTML += `<div class="cart-item"><img src="${img}" alt="${name}" class="cart-item-image" onerror="this.onerror=null;this.src='img/placeholder.png';"><div class="cart-item-details"><p class="cart-item-name">${name} <strong>(Tam: ${size})</strong>${colorInfo}</p><p class="cart-item-price">R$ ${price}</p></div><button class="remove-item-btn" data-cartid="${item.cartId}">&times;</button></div>`;
            });
            chkBtn.disabled = false;
            chkBtn.style.backgroundColor = '#25D366';
        }
        totEl.textContent = `R$ ${total.toFixed(2).replace('.', ',')}`;
        updateCartCount();
    }

    function addToCart(productId, size, color = null, colorImage = null) {
        const p = allProducts.find(p => p.id == productId);
        if (p) {
            cart.push({
                id: p.id,
                size: size,
                color: color,
                colorImage: colorImage,
                cartId: Date.now()
            });
            saveCart();
            updateCartCount();
            showNotification(`'${p.name || '?'}' (Tam: ${size}) adicionado!`);
        } else {
            showNotification("Erro ao adicionar.");
            console.error(`Produto ${productId} não encontrado.`);
        }
    }

    function removeFromCart(cartId) {
        cart = cart.filter(item => item.cartId !== cartId);
        saveCart();
        renderCartItems();
    }

    function updateCartCount() {
        if (cartCount) cartCount.textContent = cart.length;
    }

    // --- 8. FUNÇÕES DE PERSISTÊNCIA ---
    function saveCart() { try { localStorage.setItem('scCosplayCart', JSON.stringify(cart)); } catch (e) { console.error("Erro saveCart:", e); } }
    function loadCart() { try { const s = localStorage.getItem('scCosplayCart'); if (s) { cart = JSON.parse(s); if (!Array.isArray(cart)) cart = []; } } catch (e) { console.error("Erro loadCart:", e); } }
    function saveFavorites() { try { localStorage.setItem('scCosplayFavorites', JSON.stringify(favorites)); } catch (e) { console.error("Erro saveFavorites:", e); } }
    function loadFavorites() { try { const f = localStorage.getItem('scCosplayFavorites'); if (f) { favorites = JSON.parse(f); if (!Array.isArray(favorites)) favorites = []; } } catch (e) { console.error("Erro loadFavorites:", e); favorites = []; } }

    // --- 9. FUNÇÕES DO MODAL DE ENTREGA, CHECKOUT E BUSCA CEP ---
    function openDeliveryModal() {
        clearAddressFields(false);
        if (deliveryModalOverlay) deliveryModalOverlay.classList.add('active');
    }
    function closeDeliveryModal() {
        if (deliveryModalOverlay) deliveryModalOverlay.classList.remove('active');
    }

    function clearAddressFields(clearCepToo = true) {
        const flds = [addressInput, numberInput, bairroInput, cidadeInput, ufInput];
        flds.forEach(i => { if (i) { i.value = ''; i.readOnly = true; i.style.cursor = 'not-allowed'; i.classList.remove('invalid'); const e = i.closest('.form-group')?.querySelector('.error-message'); if (e) e.style.display = 'none'; } });
        if (cepStatus) cepStatus.textContent = '';
        if (cepSpinner) cepSpinner.style.display = 'none';

        if (freteInfoBox) freteInfoBox.style.display = 'none';
        freteInfoText.textContent = '';
        freteCalculado = 0;
        freteServico = '';

        if (clearCepToo && cepInput) { cepInput.value = ''; cepInput.classList.remove('invalid'); const e = cepInput.closest('.form-group')?.querySelector('.error-message'); if (e) e.style.display = 'none'; }
        const comp = document.getElementById('client-complement'); if (comp) comp.value = '';
    }

    function formatCEP(cep) {
        const d = cep.replace(/\D/g, '');
        return d.length > 5 ? d.slice(0, 5) + '-' + d.slice(5, 8) : d;
    }

    async function buscaCEP() {
        if (!cepInput || !cepStatus || !cepSpinner) return;
        if (isCalculatingFrete) return;

        const cv = cepInput.value.replace(/\D/g, '');

        clearAddressFields(false);
        cepInput.value = formatCEP(cv);

        if (cv.length !== 8) {
            if (cepInput.value.length > 0) cepStatus.textContent = 'CEP inválido.';
            return;
        }

        cepSpinner.style.display = 'inline-block';
        cepStatus.textContent = '';

        try {
            const r = await fetch(`https://brasilapi.com.br/api/cep/v1/${cv}`);
            if (!r.ok) {
                if (r.status === 404) throw new Error('CEP não encontrado');
                throw new Error('Erro ao buscar CEP');
            }
            const d = await r.json();

            cepInput.classList.remove('invalid');

            if (addressInput) addressInput.value = d.street || '';
            if (bairroInput) bairroInput.value = d.neighborhood || '';
            if (cidadeInput) cidadeInput.value = d.city || '';
            if (ufInput) ufInput.value = d.state || '';

            [addressInput, bairroInput, cidadeInput, ufInput, numberInput].forEach(i => { if (i) { i.readOnly = false; i.style.cursor = 'text'; } });
            cepStatus.textContent = 'Endereço OK!';

            calcularFrete(cv);

            if (numberInput) numberInput.focus();

        } catch (e) {
            console.error("Erro CEP:", e);
            if (e.message.includes('CEP não encontrado')) {
                cepStatus.textContent = 'CEP não encontrado.';
            } else {
                cepStatus.textContent = 'Erro ao buscar.';
            }
            cepInput.classList.add('invalid');
        } finally {
            cepSpinner.style.display = 'none';
        }
    }

    async function calcularFrete(cepDestino) {
        if (!freteInfoBox || !freteInfoText || isCalculatingFrete) return;

        isCalculatingFrete = true;
        freteInfoText.textContent = 'Calculando frete...';
        freteInfoBox.className = 'frete-info-box combinar';
        freteInfoBox.style.display = 'block';
        freteCalculado = 0;
        freteServico = '';

        const cartItemsData = cart.map(item => {
            return allProducts.find(p => p.id == item.id);
        }).filter(p => p != null);

        try {
            const response = await fetch('/.netlify/functions/calcular-frete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    cepDestino: cepDestino,
                    items: cartItemsData
                })
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || "Erro no servidor de frete");
            }

            const frete = await response.json();

            freteCalculado = frete.valor;
            freteServico = frete.servico;

            freteInfoText.textContent = `Frete (${frete.servico}): R$ ${frete.valor.toFixed(2)}`;
            freteInfoBox.className = 'frete-info-box gratis';

        } catch (error) {
            console.error('Erro ao calcular frete:', error);
            freteCalculado = 0;
            freteServico = '';
            freteInfoText.textContent = `Não foi possível calcular o frete.`;
            freteInfoBox.className = 'frete-info-box erro';
        } finally {
            isCalculatingFrete = false;
        }
    }

    // 🟢 --- FUNÇÃO TOTALMENTE MODIFICADA PARA WHATSAPP --- 🟢
    async function handleDeliverySubmit(event) {
        event.preventDefault();
        if (!deliveryForm || cart.length === 0) return;

        // --- 1. VALIDAÇÃO ---
        const requiredInputs = deliveryForm.querySelectorAll('input[required], select[required]');
        let valid = true;
        let firstInv = null;

        requiredInputs.forEach(i => {
            i.classList.remove('invalid');
            const e = i.closest('.form-group')?.querySelector('.error-message');
            if (e) e.style.display = 'none';
        });

        requiredInputs.forEach(i => {
            let inv = !i.value.trim();
            if (i.id === 'client-cep' && i.value.replace(/\D/g, '').length !== 8) inv = true;
            if (inv) {
                valid = false;
                i.classList.add('invalid');
                const e = i.closest('.form-group')?.querySelector('.error-message');
                if (e) e.style.display = 'block';
                if (!firstInv) firstInv = i;
            }
        });

        // Permitir frete = 0 se for retirada ou promoção
        if (freteCalculado === undefined || freteCalculado === null) {
            valid = false;
            showNotification("Erro: O frete não foi calculado. Verifique o CEP.");
            cepInput.classList.add('invalid');
            if (!firstInv) firstInv = cepInput;
        }

        if (!valid) {
            showNotification("Corrija os campos destacados.");
            firstInv?.focus();
            return;
        }

        // --- 2. CAPTURA DADOS DO FORMULÁRIO ---
        const nomeCompleto = document.getElementById('client-name')?.value || '';
        const cep = cepInput.value;
        const endereco = addressInput.value;
        const numero = numberInput.value;
        const complemento = document.getElementById('client-complement')?.value || '';
        const bairro = bairroInput.value;
        const cidade = cidadeInput.value;
        const estado = ufInput.value;
        const formaPagamento = document.getElementById('payment-method')?.value || 'Não informado';

        // 🟢 SALVA OS DADOS NO LOCALSTORAGE PARA USAR DEPOIS DO PAGAMENTO
        const dadosPedido = {
            nomeCompleto,
            cep,
            endereco,
            numero,
            complemento,
            bairro,
            cidade,
            estado,
            formaPagamento,
            frete: freteCalculado,
            freteServico: freteServico
        };

        localStorage.setItem('dadosPedido', JSON.stringify(dadosPedido));

        const carrinhoBackup = cart.map(item => {
            const produto = allProducts.find(p => p.id == item.id);
            return {
                nome: produto?.name || 'Produto',
                tamanho: item.size,
                cor: item.color || '',
                preco: (produto?.price || 0).toFixed(2).replace('.', ','),
                descricao: produto?.description || ''
            };
        });
        localStorage.setItem('carrinhoBackup', JSON.stringify(carrinhoBackup));

        // --- 3. PREPARAÇÃO DOS DADOS PARA O MERCADO PAGO ---
        const mpItems = cart.map(item => {
            const p = allProducts.find(prod => prod.id == item.id);
            return {
                id: String(p.id),
                title: `${p.name} (Tam: ${item.size}${item.color ? ', Cor: ' + item.color : ''})`,
                quantity: 1,
                unit_price: p.price,
                currency_id: 'BRL'
            };
        });

        const checkoutData = {
            items: mpItems,
            frete: freteCalculado,
            freteServico: freteServico,
            // 🟢 METADATA ROBUSTO PARA WEBHOOK 🟢
            metadata: {
                client_name: nomeCompleto,
                client_email: document.getElementById('client-email')?.value || 'Não informado', // Se tiver input de email
                client_phone: document.getElementById('client-phone')?.value || 'Não informado', // Se tiver input de telefone
                client_address: `${endereco}, ${numero} - ${bairro}, ${cidade}/${estado} - CEP: ${cep}`,
                client_complement: complemento,
                payment_method: formaPagamento,
                items_summary: mpItems.map(i => `${i.title} (x${i.quantity})`).join(', ')
            }
        };

        const confirmBtn = deliveryForm.querySelector('.confirm-order-btn');
        const originalText = confirmBtn.innerHTML;
        confirmBtn.disabled = true;
        confirmBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Criando Pagamento...';

        // --- 4. CHAMADA AO BACKEND (MERCADO PAGO) ---
        try {
            const response = await fetch('/.netlify/functions/criar-pagamento', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(checkoutData)
            });

            const data = await response.json();

            if (!response.ok) {
                console.error('Erro no backend Netlify/MP:', data);

                let msg = data.error || "Erro ao conectar com servidor";
                if (data.details) msg += ` (${data.details})`;

                showNotification(`Erro: ${msg}`);

                // Log mais visível para o usuário se for erro de token
                if (msg.includes("Token")) {
                    alert("Erro de Configuração: O Token do Mercado Pago não está configurado no servidor.");
                }
                return;
            }

            console.log("Sucesso! Redirecionando para:", data.redirectUrl);

            if (data.redirectUrl) {
                showNotification("Redirecionando para o pagamento...");
                closeDeliveryModal();
                deliveryForm.reset();
                // Pequeno delay para garantir que o usuário veja a msg
                setTimeout(() => {
                    window.location.href = data.redirectUrl;
                }, 1000);
            } else {
                showNotification("Erro inesperado: URL de Checkout não recebida.");
                console.error("Payload recebido sem redirectUrl:", data);
            }

        } catch (e) {
            console.error('Erro de conexão total (rede/servidor):', e);
            showNotification("Erro dev conexão. Verifique sua internet.");
        } finally {
            confirmBtn.disabled = false;
            confirmBtn.innerHTML = originalText;
        }
    }
    // 🟢 --- FIM DA MODIFICAÇÃO --- 🟢

    // --- 10. FUNÇÕES AUXILIARES ---
    function showNotification(message) { if (!notificationContainer) return; const t = document.createElement('div'); t.className = 'toast-notification'; t.innerHTML = `<i class="fas fa-check-circle"></i> ${message}`; notificationContainer.appendChild(t); setTimeout(() => t.remove(), 4000); }
    function setupScrollAnimations() { const els = document.querySelectorAll('.fade-in-element'); if ('IntersectionObserver' in window) { const o = new IntersectionObserver((e) => e.forEach(i => { if (i.isIntersecting) { i.target.classList.add('visible'); o.unobserve(i.target); } }), { threshold: 0.1 }); els.forEach(el => o.observe(el)); } else { els.forEach(el => el.classList.add('visible')); } }

    // --- 11. FUNÇÃO DE FAVORITOS ---
    function toggleFavorite(productId, buttonElement) {
        const index = favorites.indexOf(productId);
        const iconElement = buttonElement.querySelector('i');
        if (index > -1) {
            favorites.splice(index, 1);
            buttonElement.classList.remove('active');
            if (iconElement) { iconElement.classList.replace('fas', 'far'); }
            showNotification("Removido dos favoritos!");
        }
        else {
            favorites.push(productId);
            buttonElement.classList.add('active');
            if (iconElement) { iconElement.classList.replace('far', 'fas'); }
            showNotification("Adicionado aos favoritos!");
        }
        saveFavorites();

        if (isShowingFavorites) {
            filterAndSortProducts();
        }
    }

    // --- 12. CONFIGURAÇÃO INICIAL E EVENT LISTENERS (Async) ---
    async function init() {
        console.log("Iniciando...");
        try {
            if (typeof window.supabase === 'undefined' || typeof window.supabase.createClient !== 'function') { await new Promise(r => setTimeout(r, 150)); if (typeof window.supabase === 'undefined' || typeof window.supabase.createClient !== 'function') throw new Error("Supabase lib not loaded."); }
            supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
            if (!supabaseClient || typeof supabaseClient.from !== 'function') throw new Error("Failed Supabase client.");
            console.log("Supabase OK.");
        } catch (e) {
            console.error("Erro CRÍTICO Supabase:", e);
            document.body.innerHTML = `<p style="color:red;text-align:center;">Erro DB: ${e.message}. Verifique a SUPABASE_ANON_KEY.</p>`;
            return;
        }

        if (!cartIcon || !productGrid || !cartModalOverlay || !productModalOverlay || !deliveryModalOverlay || !deliveryForm || !cepInput || !productSection || !productGridWrapper || !loadMoreBtn || !paginacaoContainer) {
            console.error("Um ou mais elementos essenciais do DOM não foram encontrados. Verifique os IDs no HTML (incluindo 'paginacao').");
            return;
        }

        loadCart();
        loadFavorites();
        updateCartCount();

        try {
            if (productGrid) productGrid.innerHTML = '<p style="text-align:center;color:#888;padding:40px 0;">Carregando...</p>';

            const heroAndThemePromise = loadHeroAndTheme();
            const productsPromise = fetchProducts();

            const [, loadedProducts] = await Promise.all([heroAndThemePromise, productsPromise]);

            allProducts = loadedProducts;

            filterAndSortProducts();
        } catch (e) {
            console.error("Falha ao carregar conteúdo inicial:", e);
            if (productGrid) productGrid.innerHTML = `<p style="color:red;text-align:center;">Erro: ${e.message}</p>`;
            showNotification("Erro ao carregar.");
            return;
        }

        // --- Adiciona Event Listeners ---
        cartIcon.addEventListener('click', openCartModal);
        if (headerSearchBtn) headerSearchBtn.addEventListener('click', filterAndSortProducts);

        if (headerSearchInput && productSection) {
            headerSearchInput.addEventListener('keyup', (e) => { if (e.key === 'Enter') filterAndSortProducts(); });
            headerSearchInput.addEventListener('focus', () => {
                productSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
            });
        }

        if (sectionSearchBtn) sectionSearchBtn.addEventListener('click', filterAndSortProducts);
        if (sectionSearchInput) sectionSearchInput.addEventListener('keyup', (e) => { if (e.key === 'Enter') filterAndSortProducts(); });
        if (sortFilter) sortFilter.addEventListener('change', filterAndSortProducts);
        if (categoryFilters) categoryFilters.addEventListener('click', (e) => { if (e.target.classList.contains('category-btn')) { const a = categoryFilters.querySelector('.category-btn.active'); if (a) a.classList.remove('active'); e.target.classList.add('active'); filterAndSortProducts(); } });

        productGrid.addEventListener('click', (e) => {
            const favBtn = e.target.closest('.product-favorite');
            const addBtn = e.target.closest('.add-button');
            const card = e.target.closest('.product-card');
            if (favBtn && card && card.dataset.id) {
                e.stopPropagation();
                toggleFavorite(Number(card.dataset.id), favBtn);
            } else if ((addBtn || card) && card && card.dataset.id) {
                const p = allProducts.find(p => p.id == card.dataset.id);
                if (p && (!p.stock || p.stock > 0)) {
                    openProductModal(Number(card.dataset.id));
                }
            }
        });

        if (closeDeliveryModalBtn) closeDeliveryModalBtn.addEventListener('click', closeDeliveryModal);

        deliveryForm.addEventListener('submit', handleDeliverySubmit);

        cepInput.addEventListener('input', (e) => { e.target.value = formatCEP(e.target.value); });
        cepInput.addEventListener('blur', buscaCEP);

        [productModalOverlay, cartModalOverlay, deliveryModalOverlay].forEach(o => o.addEventListener('click', (e) => { if (e.target === o) { if (o === productModalOverlay) closeProductModal(); if (o === cartModalOverlay) closeCartModal(); if (o === deliveryModalOverlay) closeDeliveryModal(); } }));

        if (favoritesIcon) {
            favoritesIcon.addEventListener('click', (e) => {
                e.preventDefault();
                isShowingFavorites = !isShowingFavorites;

                if (isShowingFavorites) {
                    favoritesIcon.classList.add('active');
                    showNotification("Mostrando favoritos!");
                } else {
                    favoritesIcon.classList.remove('active');
                    showNotification("Mostrando todos os produtos.");
                }

                filterAndSortProducts();
            });
        }

        if (accountIcon) accountIcon.addEventListener('click', (e) => { e.preventDefault(); alert("Conta: não implementado."); });

        if (loadMoreBtn && productGridWrapper) {
            loadMoreBtn.addEventListener('click', () => {
                productGridWrapper.classList.add('expanded');
                if (loadMoreContainer) {
                    loadMoreContainer.style.display = 'none';
                }
                if (paginacaoContainer) {
                    paginacaoContainer.classList.add('visible');
                }
                currentPage = 1;
                updateProductDisplay();
            });
        }

        const handleScroll = () => { const s = window.scrollY, t = 10; if (s > t) { if (promoBanner) promoBanner.classList.add('hidden'); if (mainHeader) { mainHeader.classList.add('scrolled'); mainHeader.classList.add('banner-hidden'); } } else { if (promoBanner) promoBanner.classList.remove('hidden'); if (mainHeader) { mainHeader.classList.remove('scrolled'); mainHeader.classList.remove('banner-hidden'); } } };
        window.addEventListener('scroll', handleScroll);
        handleScroll();

        console.log("✅ Sistema iniciado com INTEGRAÇÃO WHATSAPP!");
    }

    // --- 13. INICIAR ---
    init();

});