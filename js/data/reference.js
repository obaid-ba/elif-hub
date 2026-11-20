/* Reference lists (configuration, not code — NFR-10). */
(function () {
  'use strict';
  const EH = window.EH;
  EH.REF = {
    stages: [
      { id: 'candidat', label: 'Candidat', short: 'Candidat', color: 'var(--stage-1)' },
      { id: 'preinc', label: 'Pré-incubation', short: 'Pré-inc.', color: 'var(--stage-2)' },
      { id: 'incub', label: 'Incubation', short: 'Incub.', color: 'var(--stage-3)' },
      { id: 'suivi', label: 'Suivi', short: 'Suivi', color: 'var(--stage-4)' },
      { id: 'termine', label: 'Terminé', short: 'Terminé', color: 'var(--stage-5)' }
    ],
    abandon: { id: 'abandon', label: 'Abandon' },
    activeStages: ['preinc', 'incub', 'suivi'],
    programmeTypes: ['Cohorte d\'incubation', 'Bootcamp', 'Formation', 'Événement', 'Hackathon', 'Sensibilisation', 'Networking', 'Programme financé par un partenaire'],
    activityTypes: ['Atelier', 'Atelier en ligne', 'Formation', 'Session 1-1', 'Coaching collectif', 'Mentorat collectif', 'Événement', 'Visite', 'Jury'],
    equipment: ['Vidéoprojecteur', 'Écran', 'Sonorisation', 'Paperboard', 'Ordinateurs', 'Connexion internet'],
    activityStatus: {
      draft: { label: 'Intervenant à trouver', tone: 'warn', icon: 'edit' },
      planned: { label: 'Prévue', tone: 'info', icon: 'calendar' },
      confirmed: { label: 'Confirmée', tone: 'accent', icon: 'check' },
      overdue: { label: 'À clôturer', tone: 'bad', icon: 'alert' },
      done: { label: 'Réalisée', tone: 'ok', icon: 'checkCircle' },
      postponed: { label: 'Reportée', tone: 'warn', icon: 'clock' },
      cancelled: { label: 'Annulée', tone: '', icon: 'x' }
    },
    reportStatus: {
      draft: { label: 'Brouillon', tone: '', icon: 'edit' },
      late: { label: 'En retard', tone: 'bad', icon: 'alert' },
      submitted: { label: 'À valider', tone: 'info', icon: 'send' },
      returned: { label: 'Renvoyé', tone: 'warn', icon: 'undo' },
      approved: { label: 'Validé', tone: 'ok', icon: 'lock' }
    },
    /** Beneficiary reporting (Défi 1). 'none' is only used as an activity-level override. */
    reportFormats: [
      { id: 'free', label: 'Compte rendu libre', hint: 'Un texte libre.' },
      { id: 'form', label: 'Formulaire structuré', hint: "Jusqu'à 8 questions." },
      { id: 'deliverable', label: 'Livrable fichier/lien', hint: 'Un lien vers le livrable (document, dossier partagé).' },
      { id: 'presence', label: 'Présence seule', hint: 'Une confirmation de présence en un geste.' }
    ],
    fieldTypes: [{ id: 'text', label: 'Texte' }, { id: 'number', label: 'Nombre' }, { id: 'choice', label: 'Choix' }, { id: 'rating', label: 'Note de 1 à 5' }],
    MAX_FIELDS: 8,
    DEFAULT_DUE_DAYS: 5,
    beneficiaryReportStatus: {
      todo: { label: 'À faire', tone: 'info', icon: 'edit' },
      draft: { label: 'Brouillon', tone: '', icon: 'edit' },
      submitted: { label: 'Soumis', tone: 'info', icon: 'send' },
      validated: { label: 'Validé', tone: 'ok', icon: 'lock' },
      returned: { label: 'À corriger', tone: 'warn', icon: 'undo' }
    },
    partnerTypes: ['Incubateur', 'Association', 'Institution publique', 'Université', 'Entreprise', 'Financeur', 'Expert', 'Autre'],
    contributionTypes: ['Financement', 'Expertise', 'Lieu', 'Mentorat', 'Formation', 'Autre'],
    knowledgeTypes: ['Leçon apprise', 'Modèle / outil', 'Ressource pédagogique', 'Bonne pratique', 'Documentation de projet'],
    knowledgeStatus: {
      draft: { label: 'Brouillon', tone: '' },
      published: { label: 'Publié', tone: 'ok' },
      review: { label: 'À réviser', tone: 'warn' },
      archived: { label: 'Archivé', tone: 'outline' }
    },
    selection: [
      { id: 'selected', label: 'Sélectionné' },
      { id: 'waiting', label: "Liste d'attente" },
      { id: 'rejected', label: 'Non retenu' }
    ],
    sectors: ['Agritech', 'Agro-alimentaire', 'Artisanat', 'Tourisme', 'E-commerce', 'Énergie', 'Services', 'Santé', 'Éducation', 'Numérique'],
    sources: ['Réseaux sociaux', 'Université', 'Bouche-à-oreille', 'Événement ELIFE', 'Partenaire', 'Autre'],
    /** BR-08-02 formulas, shown in KPI info tips (US-39). */
    kpis: {
      active: { label: 'Entrepreneurs actifs', formula: 'Entrepreneurs en pré-incubation, incubation ou suivi.' },
      execution: { label: 'Exécution des activités', formula: 'Réalisées ÷ (réalisées + non clôturées + annulées) sur la période.' },
      coverage: { label: 'Couverture coaching', formula: 'Entrepreneurs actifs avec au moins une séance dans les 30 jours ÷ entrepreneurs actifs.' },
      abandon: { label: "Taux d'abandon", formula: 'Abandons ÷ entrepreneurs entrés en incubation.' },
      sessions: { label: 'Séances tenues', formula: 'Séances de coaching et de mentorat saisies sur la période.' },
      partners: { label: 'Partenaires actifs', formula: 'Partenaires avec une collaboration en cours ou une intervention depuis moins de 6 mois.' },
      reporting: { label: 'Remise des rapports', formula: 'Rapports bénéficiaires obligatoires remis à temps (premier envoi avant l’échéance) ÷ rapports dus, pour les activités de la période. Un rapport est dû quand son échéance est passée ou qu’il a été remis.' },
      attendance: { label: 'Taux de présence', formula: 'Présences cochées ÷ participants attendus, sur les activités réalisées de la période.' },
      engagement: { label: 'Engagement des bénéficiaires', formula: '(Présences aux activités réalisées + rapports remis à temps) ÷ (activités réalisées attendues + rapports dus), cumulés sur les bénéficiaires dont l’espace est activé.' }
    },
    /** Incubation follow-up: expected length of each phase, in days (alert when exceeded). */
    phaseTargets: { preinc: 90, incub: 180, suivi: 90 },
    exerciseStatus: {
      todo: { label: 'À faire', tone: 'info', icon: 'edit' },
      submitted: { label: 'Rendu', tone: 'accent', icon: 'send' },
      returned: { label: 'À reprendre', tone: 'warn', icon: 'undo' },
      validated: { label: 'Validé', tone: 'ok', icon: 'checkCircle' }
    },
    fundingKinds: ['Subvention', "Prêt d'honneur", 'Prix / concours', 'Prise de participation', 'Matériel / en nature'],
    /** Activity report (PBI-19/20): expected for activities done from this date, within N days. Validator = PMO by default. */
    activityReportStatus: {
      todo: { label: 'À rédiger', tone: 'info', icon: 'edit' },
      draft: { label: 'Brouillon', tone: '', icon: 'edit' },
      submitted: { label: 'À valider', tone: 'accent', icon: 'send' },
      returned: { label: 'Renvoyé', tone: 'warn', icon: 'undo' },
      validated: { label: 'Validé', tone: 'ok', icon: 'lock' }
    },
    ACTIVITY_REPORT_START: '2026-11-01',
    ACTIVITY_REPORT_DAYS: 7,
    SPEAKER_CONFIRM_DAYS: 3,
    committeeOpinions: [{ id: 'favorable', label: 'Favorable' }, { id: 'reserve', label: 'Réservé' }, { id: 'defavorable', label: 'Défavorable' }],
    INACTIVE_MONTHS: 6,
    RISK_DAYS: 30,
    OVERDUE_GRACE: 2
  };
  EH.stageLabel = (id) => (id === 'abandon' ? 'Abandon' : (EH.REF.stages.find((s) => s.id === id) || {}).label || id);
  EH.stageIndex = (id) => EH.REF.stages.findIndex((s) => s.id === id);
})();
