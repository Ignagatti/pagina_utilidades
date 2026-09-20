/**
 * Componente para gestionar el modal de Términos, Privacidad y Seguridad Legal
 */

let legalModal = null;

export function openLegalModal(section = 'privacy') {
  if (!legalModal) return;
  
  // Activar la pestaña correspondiente
  const tabBtns = legalModal.querySelectorAll('.legal-tab-btn');
  const sections = legalModal.querySelectorAll('.legal-section-content');

  tabBtns.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.section === section);
  });

  sections.forEach(sec => {
    sec.classList.toggle('active', sec.dataset.section === section);
  });

  legalModal.classList.add('visible');
  document.body.style.overflow = 'hidden';
}

export function closeLegalModal() {
  if (!legalModal) return;
  legalModal.classList.remove('visible');
  document.body.style.overflow = '';
}

export function initLegalModal() {
  legalModal = document.getElementById('legal-modal');
  if (!legalModal) return;

  // Botón de cerrar
  document.getElementById('btn-close-legal-modal')?.addEventListener('click', closeLegalModal);

  // Cerrar al hacer clic fuera del contenido
  legalModal.addEventListener('click', (e) => {
    if (e.target === legalModal) {
      closeLegalModal();
    }
  });

  // Conmutador de pestañas dentro del modal legal
  const tabBtns = legalModal.querySelectorAll('.legal-tab-btn');
  const sections = legalModal.querySelectorAll('.legal-section-content');

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.section;
      tabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      sections.forEach(s => {
        s.classList.toggle('active', s.dataset.section === target);
      });
    });
  });

  // Enlaces en el footer y en el modal Pro para abrir secciones legales
  document.querySelectorAll('[data-open-legal]').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const section = link.getAttribute('data-open-legal') || 'privacy';
      openLegalModal(section);
    });
  });
}
