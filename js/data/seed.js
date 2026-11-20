/* Demo data (PBI-03): 6 centres, ~75 entrepreneurs, ~40 activities, 13 partners,
   5 knowledge items, 2 overdue activities, 1 abandonment. All people are fictional. */
(function () {
  'use strict';
  const EH = window.EH;

  EH.seed = function () {
    let s = 20261119;
    const rnd = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
    const pick = (a) => a[Math.floor(rnd() * a.length)];
    const int = (a, b) => a + Math.floor(rnd() * (b - a + 1));
    const T = EH.TODAY;

    const centres = [
      { id: 'beja', name: 'Béja', region: 'Nord-Ouest', officer: 'u-beja' },
      { id: 'siliana', name: 'Siliana', region: 'Nord-Ouest', officer: 'u-siliana' },
      { id: 'lekef', name: 'Le Kef', region: 'Nord-Ouest', officer: 'u-lekef' },
      { id: 'djerba', name: 'Djerba', region: 'Sud-Est', officer: 'u-djerba' },
      { id: 'tozeur', name: 'Tozeur', region: 'Sud-Ouest', officer: 'u-tozeur' },
      { id: 'sidibouzid', name: 'Sidi Bouzid', region: 'Centre-Ouest', officer: 'u-sidibouzid' }
    ];
    const users = [
      { id: 'u-pmo', name: 'Leila Mansouri', role: 'pmo', centre: null, email: 'pmo@elife.demo' },
      { id: 'u-beja', name: 'Hatem Ben Ali', role: 'officer', centre: 'beja' },
      { id: 'u-siliana', name: 'Rania Khemiri', role: 'officer', centre: 'siliana' },
      { id: 'u-lekef', name: 'Mourad Toumi', role: 'officer', centre: 'lekef' },
      { id: 'u-djerba', name: 'Sami Daoud', role: 'officer', centre: 'djerba' },
      { id: 'u-tozeur', name: 'Nadia Ferchichi', role: 'officer', centre: 'tozeur' },
      { id: 'u-sidibouzid', name: 'Bilel Amri', role: 'officer', centre: 'sidibouzid' }
    ];

    const partners = [
      { id: 'pa1', name: 'Fondation Tunisie pour le Développement', type: 'Financeur', region: 'Tunis', contact: 'Direction des programmes', phone: '+216 71 000 001', email: 'programmes@ftd.demo' },
      { id: 'pa2', name: 'Fonds Régional d\'Amorçage Sud', type: 'Financeur', region: 'Gabès', contact: 'Amel Jaziri', phone: '+216 75 000 002', email: 'contact@fras.demo' },
      { id: 'pa3', name: 'Université de Gabès', type: 'Université', region: 'Gabès', contact: 'Service insertion', phone: '+216 75 000 003', email: 'insertion@univ-gabes.demo' },
      { id: 'pa4', name: 'Association Jeunes Entrepreneurs du Nord-Ouest', type: 'Association', region: 'Béja', contact: 'Yosra Hammami', phone: '+216 78 000 004', email: 'ajeno@asso.demo' },
      { id: 'pa5', name: 'Pépinière d\'entreprises de Sidi Bouzid', type: 'Incubateur', region: 'Sidi Bouzid', contact: 'Fethi Gharbi', phone: '+216 76 000 005', email: 'pepiniere@sb.demo' },
      { id: 'pa6', name: 'Oasis Tech', type: 'Entreprise', region: 'Tozeur', contact: 'Rim Ayari', phone: '+216 76 000 006', email: 'hello@oasistech.demo' },
      { id: 'pa7', name: 'Cluster Tourisme Djerba', type: 'Association', region: 'Médenine', contact: 'Khaled Mabrouk', phone: '+216 75 000 007', email: 'cluster@tourisme-djerba.demo' },
      { id: 'pa8', name: 'Karim Haddad', type: 'Expert', region: 'Tunis', contact: 'Coach business model', phone: '+216 98 000 008', email: 'k.haddad@expert.demo' },
      { id: 'pa9', name: 'Sonia Belhaj', type: 'Expert', region: 'Sfax', contact: 'Experte marketing digital', phone: '+216 98 000 009', email: 's.belhaj@expert.demo' },
      { id: 'pa10', name: 'Mehdi Rekik', type: 'Expert', region: 'Béja', contact: 'Expert finance et levée de fonds', phone: '+216 98 000 010', email: 'm.rekik@expert.demo' },
      { id: 'pa11', name: 'Ines Kallel', type: 'Expert', region: 'Djerba', contact: 'Mentore pitch et communication', phone: '+216 98 000 011', email: 'i.kallel@expert.demo' },
      { id: 'pa12', name: 'Nabil Ferjani', type: 'Expert', region: 'Le Kef', contact: 'Expert juridique', phone: '+216 98 000 012', email: 'n.ferjani@expert.demo' },
      { id: 'pa13', name: 'Direction régionale de l\'emploi du Kef', type: 'Institution publique', region: 'Le Kef', contact: 'Bureau de l\'emploi', phone: '+216 78 000 013', email: 'dre.kef@gov.demo' }
    ];
    const coachesByCentre = {
      beja: ['pa10', 'pa8'], siliana: ['pa8', 'pa9'], lekef: ['pa12', 'pa8'],
      djerba: ['pa11', 'pa9'], tozeur: ['pa9', 'pa8'], sidibouzid: ['pa8', 'pa10']
    };

    const programmes = [
      { id: 'p1', name: 'Incubation ELIFE 2026', type: "Cohorte d'incubation", objectives: 'Accompagner les porteurs de projet des six régions pendant six mois.', start: '2026-06-01', end: '2026-12-15', funder: 'pa1', indicators: ['active', 'coverage', 'abandon', 'execution'], centres: centres.map((c) => ({ centre: c.id, officer: c.officer })), status: 'active' },
      { id: 'p2', name: 'Business Plan Bootcamp', type: 'Bootcamp', objectives: 'Produire un business plan finançable en six semaines.', start: '2026-10-01', end: '2026-11-30', funder: 'pa2', indicators: ['execution', 'sessions'], centres: ['djerba', 'beja', 'lekef'].map((c) => ({ centre: c, officer: 'u-' + c })), status: 'active' },
      { id: 'p3', name: 'Formation Business Model Canvas', type: 'Formation', objectives: 'Former les candidats au Business Model Canvas.', start: '2026-09-15', end: '2026-12-20', funder: 'pa1', indicators: ['execution'], centres: ['siliana', 'tozeur', 'sidibouzid'].map((c) => ({ centre: c, officer: 'u-' + c })), status: 'active' }
    ];
    const cohorts = centres.map((c) => ({ id: 'co-' + c.id, name: 'Cohorte 2026', programme: 'p1', centre: c.id, start: '2026-06-01', end: '2026-12-15' }));

    /* ---- entrepreneurs ---- */
    const FN_F = ['Amira', 'Ines', 'Sana', 'Nour', 'Rim', 'Hajer', 'Salma', 'Eya', 'Khawla', 'Dorra', 'Mariem', 'Yasmine', 'Chaima', 'Asma'];
    const FN_M = ['Yassine', 'Mohamed', 'Karim', 'Fedi', 'Walid', 'Anis', 'Oussema', 'Marwen', 'Slim', 'Bilel', 'Aymen', 'Hamza', 'Skander', 'Omar'];
    const LN = ['Trabelsi', 'Jebali', 'Gharbi', 'Mejri', 'Chaabane', 'Hamdi', 'Khelifi', 'Dridi', 'Zouari', 'Ayari', 'Mansouri', 'Bouazizi', 'Saidi', 'Ferchichi', 'Ben Salem', 'Hammami', 'Sassi', 'Nasri', 'Ouni', 'Riahi'];
    const IDEAS = {
      'Agritech': ['Irrigation goutte-à-goutte connectée', 'Capteurs d\'humidité pour oliveraies', 'Serre solaire modulaire'],
      'Agro-alimentaire': ['Conserverie de harissa artisanale', 'Transformation de dattes en sirop', 'Huile d\'olive bio en circuit court'],
      'Artisanat': ['Poterie de Guellala en ligne', 'Tapis tissés à la main', 'Bijoux berbères contemporains'],
      'Tourisme': ['Maison d\'hôtes écoresponsable', 'Circuits oasis à vélo', 'Expériences culinaires chez l\'habitant'],
      'E-commerce': ['Marketplace de produits du terroir', 'Livraison de paniers fermiers'],
      'Énergie': ['Installation de panneaux solaires ruraux', 'Séchoir solaire pour fruits'],
      'Services': ['Atelier de réparation de téléphones', 'Agence de communication locale'],
      'Santé': ['Kiné à domicile', 'Plateforme de rendez-vous médicaux'],
      'Éducation': ['Soutien scolaire en ligne', 'Club de robotique pour enfants'],
      'Numérique': ['Application de covoiturage régional', 'Studio de développement web']
    };
    const DIST = { beja: [3, 3, 6, 2, 1, 0], siliana: [2, 3, 5, 2, 1, 0], lekef: [3, 2, 4, 1, 0, 1], djerba: [4, 3, 5, 2, 1, 0], tozeur: [2, 2, 3, 1, 0, 0], sidibouzid: [3, 3, 4, 1, 1, 0] };
    const RISKY = { beja: 1, siliana: 0, lekef: 2, djerba: 1, tozeur: 3, sidibouzid: 1 };
    const stageIds = ['candidat', 'preinc', 'incub', 'suivi', 'termine', 'abandon'];
    const entrepreneurs = [], sessions = [], deliverables = [];
    let k = 0;
    const usedNames = new Set();
    const TOPICS = ['Business Model Canvas', 'Étude de marché', 'Prix de revient', 'Pitch', 'Plan de trésorerie', 'Statut juridique', 'Stratégie de vente', 'Recherche de financement'];
    const NEXT = ['Compléter l\'étude de marché', 'Préparer trois scénarios de prix', 'Répéter le pitch de 3 minutes', 'Rencontrer deux clients pilotes', 'Envoyer le plan de trésorerie', 'Déposer les statuts'];

    centres.forEach((c) => {
      let riskLeft = RISKY[c.id];
      DIST[c.id].forEach((n, si) => {
        for (let i = 0; i < n; i++) {
          k++;
          const female = rnd() < 0.5;
          let first, last, name;
          do { first = pick(female ? FN_F : FN_M); last = pick(LN); name = first + ' ' + last; } while (usedNames.has(name));
          usedNames.add(name);
          const sector = pick(EH.REF.sectors);
          const stage = stageIds[si];
          const e = {
            id: 'e' + k, firstName: first, lastName: last, name, gender: female ? 'F' : 'M',
            birth: `${int(1992, 2004)}-0${int(1, 9)}-${String(int(10, 28))}`,
            phone: `+216 ${int(20, 99)} ${int(100, 999)} ${int(100, 999)}`,
            email: EH.norm(first).replace(/ /g, '') + '.' + EH.norm(last).replace(/ /g, '') + '@exemple.tn',
            centre: c.id, cohort: stage === 'candidat' ? null : 'co-' + c.id, sector,
            idea: pick(IDEAS[sector]), source: pick(EH.REF.sources), maturity: int(1, 4),
            stage, history: [], abandonReason: null, version: 1
          };
          // stage history
          const h = [{ stage: 'candidat', date: stage === 'candidat' ? EH.addDays(T, -int(3, 18)) : '2026-05-' + String(int(10, 28)) }];
          if (si >= 1 && stage !== 'abandon' || stage === 'abandon') h.push({ stage: 'preinc', date: '2026-06-01', note: 'Sélectionné' });
          if (si >= 2 && stage !== 'abandon' || stage === 'abandon') h.push({ stage: 'incub', date: '2026-07-01' });
          if (si >= 3 && stage !== 'abandon') h.push({ stage: 'suivi', date: '2026-10-' + String(int(12, 28)) });
          if (si >= 4 && stage !== 'abandon') h.push({ stage: 'termine', date: '2026-11-0' + int(2, 9) });
          if (stage === 'abandon') { h.push({ stage: 'abandon', date: '2026-11-03', note: 'Emploi salarié trouvé' }); e.abandonReason = 'Emploi salarié trouvé'; }
          e.history = h;
          entrepreneurs.push(e);

          // sessions for anyone who went past candidate
          if (stage !== 'candidat') {
            const active = EH.REF.activeStages.includes(stage);
            let last;
            if (stage === 'abandon') last = '2026-10-21';
            else if (stage === 'termine') last = EH.addDays(T, -int(14, 25));
            else if (active && riskLeft > 0 && stage !== 'preinc') { last = EH.addDays(T, -int(33, 52)); riskLeft--; }
            else last = EH.addDays(T, -int(1, 22));
            const coaches = coachesByCentre[c.id];
            let d = last, count = 0;
            while (d >= '2026-06-05' && count < 7) {
              sessions.push({
                id: 'se' + (sessions.length + 1), entrepreneur: e.id, centre: c.id, date: d,
                type: rnd() < 0.7 ? 'Coaching' : 'Mentorat', coach: pick(coaches), topic: pick(TOPICS),
                nextAction: count === 0 ? pick(NEXT) : '', nextDue: count === 0 ? EH.addDays(d, int(7, 14)) : null
              });
              d = EH.addDays(d, -int(9, 16)); count++;
            }
          }
          // deliverables
          const D = (title, st, due) => deliverables.push({ id: 'd' + (deliverables.length + 1), entrepreneur: e.id, title, stage: st, due, status: 'expected' });
          if (stage === 'preinc') { D('Fiche projet', 'preinc', '2026-11-20'); D('Business Model Canvas', 'preinc', '2026-11-28'); }
          if (['incub', 'suivi', 'termine', 'abandon'].includes(stage)) {
            D('Business Model Canvas', 'preinc', '2026-06-28');
            D('Étude de marché', 'incub', '2026-' + (rnd() < 0.3 ? '11-10' : '11-' + int(22, 30)));
            D('Business plan', 'incub', '2026-12-15');
          }
        }
      });
    });
    deliverables.forEach((d) => {
      if (d.due < '2026-07-01') d.status = 'validated';
      else if (d.due < T && rnd() < 0.5) d.status = 'submitted';
    });
    // featured demo entrepreneur (Djerba, pre-incubation)
    const amira = entrepreneurs.find((e) => e.centre === 'djerba' && e.stage === 'preinc');
    const oldName = amira.name;
    Object.assign(amira, { firstName: 'Amira', lastName: 'Ben Salem', name: 'Amira Ben Salem', gender: 'F', sector: 'Agro-alimentaire', idea: 'Transformation de dattes en sirop et pâte', phone: '+216 22 418 905', email: 'amira.bensalem@exemple.tn', birth: '1998-04-17', maturity: 2 });
    usedNames.delete(oldName);
    // Le Kef at-risk and the abandonment are already in place; mark the abandoned person's open deliverables closed (EC-07)
    entrepreneurs.filter((e) => e.stage === 'abandon').forEach((e) => deliverables.filter((d) => d.entrepreneur === e.id && d.status === 'expected').forEach((d) => (d.status = 'closed')));

    /* ---- activities ---- */
    const activities = [];
    const cohortOf = (cid) => entrepreneurs.filter((e) => e.centre === cid && e.cohort);
    const A = (cid, prog, type, title, date, status, facilitator, extra = {}) => {
      const cohort = cohortOf(cid);
      const pool = cohort.filter((e) => e.stage !== 'abandon' || date < '2026-11-03');
      const rate = cid === 'tozeur' ? 0.55 : cid === 'lekef' ? 0.65 : 0.85;
      const att = status === 'done' ? pool.filter(() => rnd() < rate).map((e) => e.id) : [];
      activities.push(Object.assign({
        id: 'a' + (activities.length + 1), centre: cid, programme: prog, cohort: 'co-' + cid, type, title, date,
        duration: type === 'Formation' ? '1 jour' : '3 h', location: 'Centre ELIFE ' + centres.find((c) => c.id === cid).name,
        facilitator, expected: pool.length, status, attendees: att, notes: status === 'done' ? 'Bonne participation, supports partagés.' : ''
      }, extra));
    };
    centres.forEach((c) => {
      const [c1, c2] = coachesByCentre[c.id];
      const bp = ['djerba', 'beja', 'lekef'].includes(c.id);
      A(c.id, 'p1', 'Atelier', 'Atelier Business Model Canvas', '2026-10-08', 'done', c1);
      A(c.id, bp ? 'p2' : 'p3', 'Formation', bp ? 'Bootcamp : prévisions financières' : 'Formation BMC : segments clients', '2026-10-22', c.id === 'siliana' ? 'cancelled' : 'done', c2, c.id === 'siliana' ? { notes: 'Annulée : intempéries.' } : {});
      A(c.id, 'p1', 'Coaching collectif', 'Coaching collectif : prix de revient', '2026-10-29', 'done', c1);
      A(c.id, 'p1', 'Mentorat collectif', 'Mentorat collectif : stratégie de vente', '2026-11-05', 'done', c2);
      A(c.id, 'p1', 'Atelier', 'Atelier étude de marché', '2026-11-24', 'planned', c1);
      A(c.id, 'p1', 'Événement', 'Rencontre avec les partenaires locaux', '2026-12-03', 'planned', c.id === 'djerba' ? 'pa7' : c.id === 'tozeur' ? 'pa6' : 'pa1');
    });
    A('lekef', 'p2', 'Atelier', 'Atelier pitch', '2026-11-12', 'planned', 'pa11');
    A('tozeur', 'p3', 'Formation', 'Formation marketing digital', '2026-11-14', 'planned', 'pa9');
    A('beja', 'p2', 'Atelier', 'Atelier pitch', '2026-10-15', 'done', 'pa11');
    A('djerba', 'p2', 'Jury', 'Jury de présélection Bootcamp', '2026-11-27', 'planned', null);
    A('djerba', 'p2', 'Atelier', 'Atelier pitch', '2026-11-17', 'planned', 'pa11');
    A('sidibouzid', 'p3', 'Visite', 'Visite de la pépinière', '2026-11-18', 'planned', 'pa5');

    /* ---- collaborations ---- */
    const collaborations = [
      { id: 'cb1', partner: 'pa1', centre: 'all', programme: 'p1', contribution: 'Financement', start: '2026-06-01', end: '2026-12-31', status: 'active' },
      { id: 'cb2', partner: 'pa2', centre: 'djerba', programme: 'p2', contribution: 'Financement', start: '2026-10-01', end: '2026-11-30', status: 'active' },
      { id: 'cb3', partner: 'pa3', centre: 'djerba', programme: 'p1', contribution: 'Lieu', start: '2026-06-01', end: '2026-12-15', status: 'active' },
      { id: 'cb4', partner: 'pa4', centre: 'beja', programme: 'p1', contribution: 'Mentorat', start: '2026-06-01', end: '2026-12-15', status: 'active' },
      { id: 'cb5', partner: 'pa5', centre: 'sidibouzid', programme: 'p3', contribution: 'Lieu', start: '2026-09-15', end: '2026-12-20', status: 'active' },
      { id: 'cb6', partner: 'pa6', centre: 'tozeur', programme: 'p1', contribution: 'Expertise', start: '2026-07-01', end: '2026-12-15', status: 'active' },
      { id: 'cb7', partner: 'pa7', centre: 'djerba', programme: 'p1', contribution: 'Expertise', start: '2026-06-15', end: '2026-12-15', status: 'active' },
      { id: 'cb8', partner: 'pa13', centre: 'lekef', programme: 'p1', contribution: 'Autre', start: '2025-11-01', end: '2026-04-30', status: 'ended' }
    ];

    /* ---- knowledge ---- */
    const act = (cid, title) => (activities.find((a) => a.centre === cid && a.title === title) || {}).id;
    const knowledge = [
      { id: 'k1', type: 'Leçon apprise', title: 'Atelier pitch : un rappel SMS la veille a doublé la présence', summary: 'Sur deux ateliers pitch, la présence est passée de 6 à 13 participants après un rappel SMS envoyé la veille à 18 h, avec l\'heure et le lieu.', link: '', tags: ['pitch', 'présence', 'mobilisation'], centre: 'beja', activity: act('beja', 'Atelier pitch'), programme: 'p2', status: 'published', review: '2027-10-20', author: 'u-beja', created: '2026-10-20' },
      { id: 'k2', type: 'Modèle / outil', title: 'Modèle de Business Model Canvas commenté', summary: 'Canevas avec des exemples tirés de projets agroalimentaires de la région, prêt à imprimer en A3.', link: 'https://exemple.tn/bmc', tags: ['bmc', 'outil'], centre: 'siliana', activity: act('siliana', 'Atelier Business Model Canvas'), programme: 'p3', status: 'published', review: '2027-03-01', author: 'u-siliana', created: '2026-10-09' },
      { id: 'k3', type: 'Bonne pratique', title: 'Organiser un jury de présélection en une demi-journée', summary: 'Grille de notation sur 20, passage de 8 minutes par candidat, délibération à huis clos.', link: '', tags: ['sélection', 'jury'], centre: 'djerba', activity: null, programme: 'p2', status: 'draft', review: '2027-11-01', author: 'u-djerba', created: '2026-11-16' },
      { id: 'k4', type: 'Ressource pédagogique', title: 'Guide d\'animation des ateliers à distance', summary: 'Déroulé type d\'un atelier en visioconférence de 2 heures, avec les outils gratuits utilisés.', link: 'https://exemple.tn/guide-distance', tags: ['animation', 'distance'], centre: 'tozeur', activity: null, programme: 'p1', status: 'published', review: '2026-09-30', author: 'u-tozeur', created: '2025-09-30' },
      { id: 'k5', type: 'Leçon apprise', title: 'Coaching agricole : éviter la saison des récoltes', summary: 'Les porteurs agricoles manquent les séances en octobre. Planifier le coaching tôt le matin ou en dehors des semaines de récolte.', link: '', tags: ['présence', 'agritech', 'planification'], centre: 'sidibouzid', activity: act('sidibouzid', 'Coaching collectif : prix de revient'), programme: 'p1', status: 'published', review: '2027-10-30', author: 'u-sidibouzid', created: '2026-10-30' }
    ];

    /* ---- reports (October 2026) ---- */
    const P = '2026-10';
    const reports = [
      { id: 'r-beja', centre: 'beja', period: P, status: 'approved', comment: 'Mois conforme au plan.', submitted: '2026-11-03T10:12', approved: '2026-11-04T09:40', returnReason: null, snapshot: null, version: 1 },
      { id: 'r-siliana', centre: 'siliana', period: P, status: 'approved', comment: 'Formation du 22 annulée pour intempéries.', submitted: '2026-11-04T16:05', approved: '2026-11-05T11:20', returnReason: null, snapshot: null, version: 1 },
      { id: 'r-lekef', centre: 'lekef', period: P, status: 'draft', comment: '', submitted: null, approved: null, returnReason: null, snapshot: null, version: 1 },
      { id: 'r-djerba', centre: 'djerba', period: P, status: 'draft', comment: '', submitted: null, approved: null, returnReason: null, snapshot: null, version: 1 },
      { id: 'r-tozeur', centre: 'tozeur', period: P, status: 'submitted', comment: 'Présence en baisse pendant la récolte des dattes.', submitted: '2026-11-06T14:30', approved: null, returnReason: null, snapshot: null, version: 1 },
      { id: 'r-sidibouzid', centre: 'sidibouzid', period: P, status: 'returned', comment: 'RAS.', submitted: '2026-11-05T09:00', approved: null, returnReason: 'Les présences du coaching collectif du 29 octobre semblent incomplètes : merci de vérifier.', snapshot: null, version: 1 }
    ];

    const audit = [
      { id: 'au1', at: '2026-11-04T09:40', user: 'u-pmo', centre: 'beja', action: 'Rapport validé', object: 'Rapport octobre 2026 · Béja', detail: 'Période verrouillée' },
      { id: 'au2', at: '2026-11-05T11:20', user: 'u-pmo', centre: 'siliana', action: 'Rapport validé', object: 'Rapport octobre 2026 · Siliana', detail: 'Période verrouillée' },
      { id: 'au3', at: '2026-11-06T14:30', user: 'u-tozeur', centre: 'tozeur', action: 'Rapport soumis', object: 'Rapport octobre 2026 · Tozeur', detail: '' },
      { id: 'au4', at: '2026-11-07T10:02', user: 'u-pmo', centre: 'sidibouzid', action: 'Rapport renvoyé', object: 'Rapport octobre 2026 · Sidi Bouzid', detail: 'Présences du 29 octobre incomplètes' }
    ];

    const seeded = EH.seedBeneficiaryReporting({ centres, users, entrepreneurs, activities, audit });
    const logistics = EH.seedLogistics({ centres, users, entrepreneurs, activities });
    const base = Object.assign({ version: 5, rooms: logistics.rooms, centres, users, partners, programmes, cohorts, entrepreneurs, sessions, deliverables, activities, collaborations, knowledge, reports, audit, corrections: [] }, seeded);
    Object.assign(base, EH.seedIncubation(base));
    EH.seedWorkflow(base);
    return base;
  };

  /* ---------- Workflow completion (PBI-08, 10, 13, 19-23): demo cases for the jury script ----------
     Mutates d in place: session history back to June, two Djerba activities (speaker to confirm at J-2,
     reminder to send for tomorrow), interviews and committee opinions, activity reports. Also upgrades older saves. */
  EH.seedWorkflow = function (d) {
    const T = EH.TODAY;
    // 1. coaching history back to the start of the programme (deterministic, no random draw)
    const TOPICS = ['Idéation', 'Business Model Canvas', 'Étude de marché', 'Proposition de valeur', 'Prototype', 'Clients pilotes'];
    d.entrepreneurs.forEach((e) => {
      const mine = d.sessions.filter((s) => s.entrepreneur === e.id);
      if (!mine.length) return;
      const first = mine.reduce((m, s) => (s.date < m.date ? s : m));
      let day = EH.addDays(first.date, -14), i = 0;
      while (day >= '2026-06-05') {
        d.sessions.push({ id: 'se-h' + e.id + '-' + i, entrepreneur: e.id, centre: e.centre, date: day, type: i % 3 ? 'Coaching' : 'Mentorat', coach: first.coach, topic: TOPICS[i % TOPICS.length], nextAction: '', nextDue: null });
        day = EH.addDays(day, -14); i++;
      }
    });
    // 2. Djerba: one speaker still "proposed" at J-2, one activity tomorrow whose reminder is not sent yet
    const officer = (d.centres.find((c) => c.id === 'djerba') || {}).officer;
    const pool = d.entrepreneurs.filter((e) => e.centre === 'djerba' && e.cohort && ['preinc', 'incub', 'suivi'].includes(e.stage));
    const add = (title, date, time, durationMin, facilitator, facilitatorStatus, room, type, budget, content) => {
      if (d.activities.some((a) => a.centre === 'djerba' && a.title === title)) return;
      d.activities.push({ id: 'a-w' + (d.activities.length + 1), centre: 'djerba', programme: 'p1', cohort: 'co-djerba', type, title, date, time, durationMin, duration: EH.fmtDuration(durationMin),
        location: 'Centre ELIFE Djerba', room, facilitator, facilitatorStatus, staff: officer ? [officer] : [], expected: pool.length, status: 'planned', attendees: [], notes: '',
        budget, equipment: ['Vidéoprojecteur', 'Paperboard'], content, supports: '', onlineLink: '', contact: 'Chargé du centre : Sami Daoud', participant: null, reminders: [] });
    };
    add('Mentorat pitch : répétition générale', EH.addDays(T, 1), '09:30', 120, 'pa11', 'confirmed', 'ro-djerba-1', 'Mentorat collectif', 250, 'Passage de chaque porteur (3 minutes), retours du jury fictif, plan d’amélioration.');
    add('Atelier financement participatif', EH.addDays(T, 2), '10:00', 120, 'pa10', 'proposed', 'ro-djerba-2', 'Atelier', 300, 'Panorama des plateformes, préparer une campagne, cas pratiques.');
    // 3. selection steps for two Djerba candidates
    const cands = d.entrepreneurs.filter((e) => e.centre === 'djerba' && e.stage === 'candidat');
    if (cands[0] && !cands[0].interview) cands[0].interview = { date: EH.addDays(T, -2), score: 4, comment: 'Projet clair, porteur motivé ; marché local à vérifier.', by: officer };
    if (cands[1] && !cands[1].interview) {
      cands[1].interview = { date: EH.addDays(T, -6), score: 3, comment: 'Idée intéressante, besoin de structurer le modèle économique.', by: officer };
      cands[1].committee = { date: EH.addDays(T, -1), opinion: 'favorable', score: 4, comment: 'Avis favorable sous réserve de suivre le bootcamp business plan.', by: officer };
    }
    // 4. activity reports for activities done since the start of the feature
    const reports = d.activityReports || (d.activityReports = []);
    const AT = (cid, title, status, difficulties, needs, extra = {}) => {
      const a = d.activities.find((x) => x.centre === cid && x.title === title && x.status === 'done');
      if (!a || reports.some((r) => r.activityId === a.id)) return;
      const r = Object.assign({ id: 'ar-' + cid, activityId: a.id, centre: cid, status, difficulties, needs, submittedAt: status === 'draft' ? null : EH.addDays(a.date, 3) + 'T17:10', reviewedAt: null, reviewedBy: null, returnReason: null, snapshot: null, version: 1 }, extra);
      if (status === 'validated') { r.reviewedAt = EH.addDays(a.date, 5) + 'T09:30'; r.reviewedBy = 'u-pmo'; r.snapshot = EH.q.activityReportFigures(d, a); }
      reports.push(r);
    };
    const M = 'Mentorat collectif : stratégie de vente';
    AT('beja', M, 'submitted', 'Deux porteurs absents pour raisons familiales.', 'Un mentor spécialisé en vente B2B.');
    AT('siliana', M, 'validated', 'Aucune.', 'Aucun.');
    AT('sidibouzid', M, 'submitted', 'Salle trop petite pour le groupe.', 'Réserver la salle de la pépinière.');
    AT('tozeur', M, 'draft', 'Présence faible pendant la récolte des dattes.', '');
    return d;
  };

  /* ---------- Incubation follow-up: exercises given to beneficiaries, funders linked to projects ----------
     Only needs entrepreneurs (also used to upgrade an older save, see store.load). */
  EH.seedIncubation = function (d) {
    const T = EH.TODAY, exercises = [], fundings = [];
    const ents = (cid, stages) => d.entrepreneurs.filter((e) => e.centre === cid && stages.includes(e.stage));
    const X = (e, title, instructions, given, due, status, answer = '', reviewComment = '') => exercises.push({
      id: 'ex' + (exercises.length + 1), entrepreneurId: e.id, centre: e.centre, stage: e.stage, title, instructions, givenAt: given, due, status,
      answer, link: '', submittedAt: status === 'submitted' || status === 'validated' ? EH.addDays(given, 4) + 'T18:20' : null,
      reviewedAt: status === 'validated' || status === 'returned' ? EH.addDays(given, 6) + 'T10:00' : null, reviewComment, createdBy: 'u-' + e.centre, version: 1 });
    const portal = d.entrepreneurs.filter((e) => e.portal);
    const amira = portal.find((e) => e.centre === 'djerba') || ents('djerba', ['incub'])[0];
    if (amira) {
      X(amira, 'Rédiger la proposition de valeur', 'En 5 lignes : pour qui, quel problème, quelle solution, pourquoi vous plutôt qu’un concurrent.', EH.addDays(T, -20), EH.addDays(T, -12), 'validated', 'Pour les épiceries fines et les pâtissiers de Djerba, un sirop de dattes naturel, sans sucre ajouté, produit à partir des dattes déclassées de la région.', 'Clair et concret. Gardez cette phrase pour le pitch.');
      X(amira, 'Calculer le prix de revient d’une bouteille', 'Listez tous les coûts (dattes, énergie, bouteille, étiquette, main-d’œuvre) pour une bouteille de 50 cl. Utilisez le modèle partagé en séance.', EH.addDays(T, -8), EH.addDays(T, -1), 'submitted', 'Coût de revient : 6,8 DT la bouteille de 50 cl. L’emballage représente 35 % du coût.');
      X(amira, 'Interviewer cinq clients potentiels', 'Posez les 6 questions du guide d’entretien à cinq personnes de votre cible et notez les réponses marquantes.', EH.addDays(T, -2), EH.addDays(T, 6), 'todo');
    }
    portal.filter((e) => e !== amira).forEach((e, i) => {
      X(e, 'Mettre à jour le plan de trésorerie', 'Complétez les 6 prochains mois du plan de trésorerie avec les ventes réelles d’octobre.', EH.addDays(T, -15), EH.addDays(T, -3 - i), 'todo');
      X(e, 'Préparer le pitch de 3 minutes', 'Enregistrez une vidéo de votre pitch (lien privé) en suivant la structure vue en atelier.', EH.addDays(T, -12), EH.addDays(T, -5), 'returned', 'https://exemple.tn/video-pitch', 'La partie marché est trop longue : réduisez-la à 30 secondes.');
    });
    ['djerba', 'beja', 'lekef', 'tozeur', 'siliana', 'sidibouzid'].forEach((cid) => {
      const other = ents(cid, ['incub']).find((e) => !e.portal);
      if (other) X(other, 'Lister les autorisations nécessaires', 'Identifiez les autorisations et le statut juridique adaptés à votre activité, avec leur coût.', EH.addDays(T, -6), EH.addDays(T, 8), 'todo');
    });

    const F = (partner, e, kind, amount, date, note = '') => fundings.push({ id: 'fu' + (fundings.length + 1), partner, entrepreneurId: e.id, centre: e.centre, kind, amount, date, note });
    if (amira) F('pa2', amira, "Prêt d'honneur", 8000, '2026-10-20', 'Presse à dattes et pasteurisateur');
    ['djerba', 'beja', 'siliana', 'lekef', 'tozeur', 'sidibouzid'].forEach((cid, i) => {
      const list = ents(cid, ['incub', 'suivi']).filter((e) => e !== amira);
      if (list[0]) F('pa1', list[0], 'Subvention', 5000 + 1500 * i, '2026-09-1' + (i % 9), 'Fonds d’amorçage ELIFE');
      if (list[1] && i % 2 === 0) F(cid === 'djerba' || cid === 'lekef' || cid === 'beja' ? 'pa2' : 'pa1', list[1], i ? 'Prix / concours' : 'Matériel / en nature', 3000 + 500 * i, '2026-10-0' + (i + 2));
    });
    return { exercises, fundings };
  };

  /* ---------- Backlog merge, phase 1: rooms, time slots, budget, equipment, content ----------
     Idempotent: fills only missing fields, so it also upgrades a v4 save. Returns { rooms }. */
  EH.seedLogistics = function (d) {
    const rooms = d.rooms && d.rooms.length ? d.rooms : d.centres.flatMap((c) => [
      { id: `ro-${c.id}-1`, centre: c.id, name: 'Salle de formation', capacity: 30 },
      { id: `ro-${c.id}-2`, centre: c.id, name: 'Salle de réunion', capacity: 12 }
    ]);
    const idx = Object.fromEntries(d.centres.map((c, i) => [c.id, i]));
    const SLOT = ['09:00', '11:00', '14:00', '16:00', '09:00', '16:00'];
    const DUR = { Formation: 420, 'Événement': 120, Jury: 240, Visite: 120, 'Session 1-1': 60 };
    const BUDGET = { Formation: 1200, Atelier: 400, 'Atelier en ligne': 100, 'Événement': 1500, 'Coaching collectif': 300, 'Mentorat collectif': 300, Jury: 500, Visite: 200, 'Session 1-1': 0 };
    const EQUIP = { Formation: ['Vidéoprojecteur', 'Paperboard'], Atelier: ['Vidéoprojecteur', 'Paperboard'], 'Événement': ['Sonorisation', 'Vidéoprojecteur'], 'Atelier en ligne': ['Connexion internet'] };
    const officer = (cid) => (d.centres.find((c) => c.id === cid) || {}).officer;
    const fill = (a) => {
      if (a.time) return;
      const parsed = /jour/.test(a.duration || '') ? 420 : /(\d+)\s*h/.test(a.duration || '') ? +RegExp.$1 * 60 : 0;
      a.durationMin = DUR[a.type] || parsed || 180;
      a.duration = EH.fmtDuration(a.durationMin);
      a.time = a.type === 'Formation' ? '09:00' : SLOT[idx[a.centre] || 0];
      a.room = a.type === 'Visite' ? null : `ro-${a.centre}-${/Coaching|Mentorat/.test(a.type) ? 2 : 1}`;
      a.staff = officer(a.centre) ? [officer(a.centre)] : [];
      a.facilitatorStatus = a.facilitator ? 'confirmed' : null;
      a.budget = BUDGET[a.type] != null ? BUDGET[a.type] : 300;
      a.equipment = EQUIP[a.type] || ['Paperboard'];
      a.content = a.content || `Accueil, ${a.title.charAt(0).toLowerCase() + a.title.slice(1)}, mise en pratique en petits groupes, questions.`;
      a.supports = a.supports || '';
      a.onlineLink = a.onlineLink || '';
      a.contact = a.contact || `Chargé du centre : ${(d.users.find((u) => u.id === officer(a.centre)) || {}).name || '—'}`;
      a.participant = a.participant || null;
    };
    d.activities.forEach(fill);
    const add = (cid, prog, type, title, date, time, facilitator, extra) => {
      if (d.activities.some((a) => a.centre === cid && a.title === title)) return;
      const pool = d.entrepreneurs.filter((e) => e.centre === cid && e.cohort && ['preinc', 'incub', 'suivi'].includes(e.stage));
      const a = { id: 'a' + (d.activities.length + 1), centre: cid, programme: prog, cohort: 'co-' + cid, type, title, date, location: 'Centre ELIFE ' + d.centres.find((c) => c.id === cid).name, facilitator, expected: pool.length, status: 'planned', attendees: [], notes: '' };
      fill(a);
      Object.assign(a, { time }, extra);
      d.activities.push(a);
    };
    // PBI-25: one room clash (same room, overlapping slot) and one speaker not confirmed 2 days before
    add('djerba', 'p1', 'Atelier', 'Atelier marketing digital', '2026-11-24', '17:00', 'pa9', {});
    add('tozeur', 'p1', 'Formation', 'Formation comptabilité de base', '2026-11-21', '14:00', 'pa8', { durationMin: 180, duration: '3 h', facilitatorStatus: 'proposed' });
    return { rooms };
  };

  /* ---------- Défi 1: beneficiary reporting (fictional data) ----------
     Mutates users / entrepreneurs / activities / audit in place and returns the new collections.
     Also used to migrate a v3 save (see store.load), which is why it only needs those inputs. */
  EH.seedBeneficiaryReporting = function (d) {
    const act = (cid, title) => d.activities.find((a) => a.centre === cid && a.title === title);
    const ent = (cid, stage, skip = 0) => d.entrepreneurs.filter((e) => e.centre === cid && e.stage === stage)[skip];
    const T_BMC = 'Atelier Business Model Canvas', T_COACH = 'Coaching collectif : prix de revient', T_MENT = 'Mentorat collectif : stratégie de vente';
    const T_BOOT = 'Bootcamp : prévisions financières', T_FORM = 'Formation BMC : segments clients', T_PITCH = 'Atelier pitch', T_EVENT = 'Rencontre avec les partenaires locaux';

    /* beneficiaries: one entrepreneur record each, in three different centres */
    const amira = d.entrepreneurs.find((e) => e.name === 'Amira Ben Salem' && e.centre === 'djerba');
    const beneficiaries = [amira, ent('beja', 'incub'), ent('tozeur', 'incub')];
    beneficiaries.forEach((e) => {
      e.portal = true;
      d.users.push({ id: 'u-b-' + e.id, name: e.name, role: 'beneficiaire', centre: e.centre, entrepreneurId: e.id, email: e.email });
      d.activities.filter((a) => a.centre === e.centre && a.cohort === e.cohort && a.status === 'done' && !a.attendees.includes(e.id)).forEach((a) => a.attendees.push(e.id));
    });
    const [bAmira, bBeja, bTozeur] = beneficiaries;

    /* requirements: immutable records; an edit creates version + 1 (key = scope + target) */
    const Rq = (id, scope, target, version, format, fields, dueDays, mandatory, feedbackVisible) =>
      ({ id, scope, programmeId: scope === 'programme' ? target : null, activityId: scope === 'activity' ? target : null, version, format, fields, dueDays, mandatory, feedbackVisible });
    const requirements = [
      Rq('rq-p1', 'programme', 'p1', 1, 'form', [
        { id: 'q1', label: "Ce que j'ai retenu", type: 'text', required: true },
        { id: 'q2', label: 'Utilité pour mon projet', type: 'rating', required: true },
        { id: 'q3', label: 'Avancement de mon projet', type: 'choice', required: true, options: ['En avance', 'Dans les temps', 'En retard'] },
        { id: 'q4', label: 'Heures consacrées cette semaine', type: 'number', required: false }
      ], 5, true, true),
      Rq('rq-p2', 'programme', 'p2', 1, 'deliverable', [], 7, true, true),
      Rq('rq-p3', 'programme', 'p3', 1, 'free', [], 10, false, false)
    ];
    const actReq = (id, a, version, format, fields, dueDays, mandatory = true, fb = true) => requirements.push(Rq(id, 'activity', a.id, version, format, fields, dueDays, mandatory, fb));
    actReq('rq-dj-coach', act('djerba', T_COACH), 1, 'form', [
      { id: 'q1', label: "Ce que j'ai appliqué", type: 'text', required: true },
      { id: 'q2', label: 'Confiance sur mon prix de revient', type: 'rating', required: true }], 14);
    actReq('rq-dj-ment', act('djerba', T_MENT), 1, 'form', [
      { id: 'q1', label: 'Mon plan de vente en une phrase', type: 'text', required: true },
      { id: 'q2', label: 'Canal prioritaire', type: 'choice', required: true, options: ['Marché local', 'En ligne', 'Revendeurs'] }], 21);
    actReq('rq-bj-ment-1', act('beja', T_MENT), 1, 'form', [
      { id: 'q1', label: 'Ce que je retiens', type: 'text', required: true },
      { id: 'q2', label: 'Utilité pour mon projet', type: 'rating', required: true }], 5);
    actReq('rq-bj-ment-2', act('beja', T_MENT), 2, 'form', [
      { id: 'q1', label: 'Ce que je retiens', type: 'text', required: true },
      { id: 'q2', label: 'Utilité pour mon projet', type: 'rating', required: true },
      { id: 'q3', label: 'Ma prochaine étape', type: 'text', required: false }], 5);
    d.centres.forEach((c) => { const a = act(c.id, T_EVENT); if (a) actReq('rq-ev-' + c.id, a, 1, 'none', [], 0, false, false); });
    const rq = (id) => requirements.find((r) => r.id === id);

    /* beneficiary reports: every status, two overdue (Amira + Béja coaching), one returned (Béja BMC) */
    const Rp = (n, a, e, req, status, answers, extra = {}) => ({
      id: 'br-' + n, activityId: a.id, entrepreneurId: e.id, requirementId: req.id, requirementVersion: req.version, answers, status,
      createdAt: (extra.submittedAt || extra.updatedAt || '2026-11-10T09:00').slice(0, 10), submittedAt: null, firstSubmittedAt: null, reviewedBy: null, reviewedAt: null, reviewComment: '', version: 1, ...extra
    });
    const sub = (at) => ({ submittedAt: at, firstSubmittedAt: at });
    const reports = [
      Rp(1, act('djerba', T_BMC), bAmira, rq('rq-p1'), 'validated', { q1: "Le canevas m'a aidée à clarifier mes segments clients.", q2: '4', q3: 'Dans les temps', q4: '3' }, { ...sub('2026-10-10T18:20:00'), reviewedBy: 'u-djerba', reviewedAt: '2026-10-12T09:15:00', reviewComment: 'Bien documenté, merci.', version: 3 }),
      Rp(2, act('djerba', T_BOOT), bAmira, rq('rq-p2'), 'submitted', { link: 'https://exemple.tn/amira/previsions-financieres.pdf', note: 'Première version des prévisions sur douze mois.' }, { ...sub('2026-10-28T20:05:00'), version: 2 }),
      Rp(3, act('djerba', T_MENT), bAmira, rq('rq-dj-ment'), 'draft', { q1: 'Vente directe aux hôtels de Djerba' }, { updatedAt: '2026-11-17T21:10:00', version: 1 }),
      Rp(4, act('beja', T_BMC), bBeja, rq('rq-p1'), 'returned', { q1: 'Structurer mon offre en trois segments.', q2: '5', q3: 'Dans les temps', q4: '2' }, { ...sub('2026-10-09T21:40:00'), reviewedBy: 'u-beja', reviewedAt: '2026-10-11T10:05:00', reviewComment: "Précisez l'avancement réel : « Dans les temps » ne correspond pas à votre retard sur l'étude de marché.", version: 3 }),
      Rp(5, act('beja', T_BOOT), bBeja, rq('rq-p2'), 'validated', { link: 'https://exemple.tn/beja/previsions.xlsx', note: '' }, { ...sub('2026-10-27T16:30:00'), reviewedBy: 'u-beja', reviewedAt: '2026-10-28T08:50:00', reviewComment: 'Prévisions cohérentes.', version: 3 }),
      Rp(6, act('beja', T_MENT), bBeja, rq('rq-bj-ment-1'), 'submitted', { q1: 'Cibler les restaurants avant les épiceries.', q2: '4' }, { ...sub('2026-11-07T10:30:00'), version: 2 }),
      Rp(7, act('beja', T_PITCH), bBeja, rq('rq-p2'), 'validated', { link: 'https://exemple.tn/beja/pitch.pdf', note: 'Remis après relance.' }, { ...sub('2026-10-24T12:00:00'), reviewedBy: 'u-beja', reviewedAt: '2026-10-25T09:00:00', reviewComment: '', version: 3 }),
      Rp(8, act('tozeur', T_BMC), bTozeur, rq('rq-p1'), 'validated', { q1: 'Mon client type est le touriste en séjour oasis.', q2: '5', q3: 'En avance', q4: '4' }, { ...sub('2026-10-12T19:00:00'), reviewedBy: 'u-tozeur', reviewedAt: '2026-10-14T11:00:00', reviewComment: '', version: 3 }),
      Rp(9, act('tozeur', T_COACH), bTozeur, rq('rq-p1'), 'submitted', { q1: 'Calculer le coût de chaque datte conditionnée.', q2: '4', q3: 'Dans les temps', q4: '5' }, { ...sub('2026-11-02T20:15:00'), version: 2 }),
      Rp(10, act('tozeur', T_MENT), bTozeur, rq('rq-p1'), 'validated', { q1: 'Vendre aux hôtels par abonnement mensuel.', q2: '5', q3: 'En avance', q4: '2' }, { ...sub('2026-11-09T18:40:00'), reviewedBy: 'u-tozeur', reviewedAt: '2026-11-10T09:30:00', reviewComment: 'Très bien.', version: 3 })
    ];

    d.audit.push(
      { id: 'au-b1', at: '2026-10-12T09:15', user: 'u-djerba', centre: 'djerba', action: 'Rapport bénéficiaire validé', object: `Amira Ben Salem · ${T_BMC}`, detail: 'Soumis → Validé', before: 'Soumis', after: 'Validé' },
      { id: 'au-b2', at: '2026-10-11T10:05', user: 'u-beja', centre: 'beja', action: 'Rapport bénéficiaire renvoyé', object: `${bBeja.name} · ${T_BMC}`, detail: 'Soumis → À corriger · Précisez l’avancement réel', before: 'Soumis', after: 'À corriger' }
    );
    return { reportingRequirements: requirements, beneficiaryReports: reports, beneficiaryCorrections: [] };
  };
})();
