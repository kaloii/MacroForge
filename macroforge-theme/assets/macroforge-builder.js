if (window.macroForgeInitialized) {
  // Prevent duplicate execution if the script is loaded twice
  console.warn("MacroForge Builder already initialized. Skipping duplicate execution.");
} else {
  window.macroForgeInitialized = true;

  document.addEventListener('DOMContentLoaded', () => {
    const weightInput = document.getElementById('user-weight');
    const targetProteinEl = document.getElementById('calc-protein-target');
    const objBtns = document.querySelectorAll('.mf-obj-btn');
    const gearSelect = document.getElementById('slot-gear-select');
    const mealSelect = document.getElementById('slot-meal-select');
    const suppSelect = document.getElementById('slot-supp-select');
    const addCartBtn = document.getElementById('mf-add-stack-to-cart');

    let activeProteinRatio = 2.2;
    let isSubmitting = false;

    function calculateTargetMacros() {
      const weight = parseFloat(weightInput?.value) || 70;
      const targetProtein = Math.round(weight * activeProteinRatio);
      if (targetProteinEl) targetProteinEl.textContent = targetProtein;

      const mealProtein = parseFloat(mealSelect?.dataset.protein || 45) * 2; 
      const coverage = Math.min(100, Math.round((mealProtein / targetProtein) * 100));
      
      const coverageEl = document.getElementById('macro-coverage-pct');
      if (coverageEl) coverageEl.textContent = `${coverage}%`;
      
      recalculatePricing();
    }

    function recalculatePricing() {
      const gearPrice = parseFloat(gearSelect?.dataset.price || 0);
      const mealPrice = parseFloat(mealSelect?.dataset.price || 0);
      const suppPrice = parseFloat(suppSelect?.dataset.price || 0);

      const rawTotal = (gearPrice + mealPrice + suppPrice) / 100;
      const discount = rawTotal > 150 ? 0.20 : 0.15; 
      const finalTotal = rawTotal * (1 - discount);

      const discountBadge = document.getElementById('stack-discount-badge');
      const oldPriceEl = document.getElementById('bundle-old-price');
      const finalPriceEl = document.getElementById('bundle-final-price');

      if (discountBadge) discountBadge.textContent = `${Math.round(discount * 100)}% OFF`;
      if (oldPriceEl) oldPriceEl.textContent = `$${rawTotal.toFixed(2)}`;
      if (finalPriceEl) finalPriceEl.textContent = `$${finalTotal.toFixed(2)}`;
    }

    objBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        objBtns.forEach(b => b.classList.remove('active', 'mf-selected'));
        btn.classList.add('active', 'mf-selected');
        activeProteinRatio = parseFloat(btn.dataset.proteinRatio) || 2.2;
        calculateTargetMacros();
      });
    });

    if (weightInput) {
      weightInput.addEventListener('input', calculateTargetMacros);
    }

    if (addCartBtn) {
      // Remove any previously cloned/lingering listeners if re-initialized
      const newBtn = addCartBtn.cloneNode(true);
      addCartBtn.parentNode.replaceChild(newBtn, addCartBtn);

      newBtn.addEventListener('click', async () => {
        if (isSubmitting) return;
        isSubmitting = true;

        try {
          const cartRes = await fetch('/cart.js');
          const cartData = await cartRes.json();
          const hasExistingStack = cartData.items.some(item => item.properties && item.properties._stack_id);

          if (hasExistingStack) {
            alert('You already have a Forge Stack bundle in your cart. Only one bundle is allowed per transaction.');
            isSubmitting = false;
            return;
          }
        } catch (err) {
          console.error('Failed to verify cart state', err);
        }

        const stackId = 'stack_' + Date.now() + Math.random().toString(36).substring(2, 7);

        const items = [
          { id: gearSelect ? gearSelect.value : null, quantity: 1, properties: { _stack_id: stackId, _stack_role: 'gear' } },
          { id: mealSelect ? mealSelect.value : null, quantity: 1, properties: { _stack_id: stackId, _stack_role: 'meal' } },
          { id: suppSelect ? suppSelect.value : null, quantity: 1, properties: { _stack_id: stackId, _stack_role: 'supp' } }
        ].filter(item => item.id);

        newBtn.disabled = true;
        newBtn.textContent = "BUILDING STACK...";

        try {
          const response = await fetch('/cart/add.js', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items })
          });
          if (response.ok) {
            window.location.href = '/cart';
          } else {
            throw new Error('Failed response from cart add');
          }
        } catch (err) {
          console.error('Failed to add bundle to cart', err);
          isSubmitting = false;
          newBtn.disabled = false;
          newBtn.textContent = "ADD ENTIRE FORGE STACK TO CART";
        }
      });
    }

    calculateTargetMacros();
  });
}