import type { Locale } from "@/lib/constants";

// The privacy notice, written against Law 195/2024 on the protection of personal
// data, in force in the Republic of Moldova since 23 August 2026. That law
// transposes the GDPR and repeals Law 133/2011.
//
// It is deliberately written from the ACTUAL data this site holds — the tables
// in supabase/migrations, the Meta Pixel, Supabase and Vercel — because the law
// requires the notice to correspond to the real flow of data, not to a template.
// If the schema changes, this changes with it.
//
// OPERATOR is the one thing that cannot be derived from the code. The legal
// entity, its IDNO and its registered address must be filled in by the studio
// before this is published — naming the wrong controller is worse than naming
// none, so the page refuses to render a fake one and shows a visible notice
// instead. See PRIVACY_TODO below.

export const OPERATOR = {
  // TODO(dellys): replace with the real registered company.
  legalName: "",
  idno: "",
  registeredAddress: "",
  email: "",
  phone: "+373 68 019 576",
  sites: ["str. Trandafirilor 20, Chișinău", "bd. Moscova 6, et. 3, Chișinău"],
  domain: "dellys.md",
};

export const OPERATOR_READY = Boolean(
  OPERATOR.legalName && OPERATOR.idno && OPERATOR.registeredAddress && OPERATOR.email,
);

export interface PrivacySection {
  heading: string;
  paragraphs?: string[];
  bullets?: string[];
  table?: { head: string[]; rows: string[][] };
}

export interface PrivacyDoc {
  title: string;
  updated: string;
  intro: string[];
  sections: PrivacySection[];
}

const UPDATED = "1 septembrie 2026";

const ro: PrivacyDoc = {
  title: "Politica de confidențialitate",
  updated: `Ultima actualizare: ${UPDATED}`,
  intro: [
    "Această politică explică ce date cu caracter personal colectăm despre tine, de ce le colectăm, cât timp le păstrăm și ce drepturi ai asupra lor.",
    "Este redactată în conformitate cu Legea nr. 195/2024 privind protecția datelor cu caracter personal, în vigoare în Republica Moldova de la 23 august 2026, care transpune Regulamentul (UE) 2016/679 (GDPR) și abrogă Legea nr. 133/2011.",
  ],
  sections: [
    {
      heading: "1. Cine este operatorul",
      paragraphs: [
        `Operatorul datelor este ${OPERATOR.legalName || "«[denumirea juridică]»"}, IDNO ${OPERATOR.idno || "«[IDNO]»"}, cu sediul în ${OPERATOR.registeredAddress || "«[adresa juridică]»"} (denumit în continuare „Dellys", „noi").`,
        `Ne poți contacta la ${OPERATOR.email || "«[email de contact]»"} sau la ${OPERATOR.phone}.`,
        `Sălile noastre: ${OPERATOR.sites.join(" · ")}.`,
      ],
    },
    {
      heading: "2. Ce date colectăm și de ce",
      paragraphs: [
        "Colectăm doar datele necesare pentru a-ți gestiona abonamentul și accesul la ședințe. Tabelul de mai jos reflectă exact ce este stocat în sistemul nostru.",
      ],
      table: {
        head: ["Categoria de date", "Scopul", "Temeiul legal"],
        rows: [
          [
            "Nume, email, telefon, limba preferată, sala la care vii",
            "Crearea și administrarea contului tău; autentificarea prin link trimis pe email",
            "Executarea contractului (art. 5 alin. (1) lit. b)",
          ],
          [
            "Codul tău QR de acces",
            "Identificarea ta la intrarea în sală, la tabletă",
            "Executarea contractului",
          ],
          [
            "Abonamentul: tipul, ședințele rămase, data de început și de expirare, suma achitată și metoda de plată",
            "Evidența abonamentului și a ședințelor consumate; obligații contabile",
            "Executarea contractului; obligație legală (evidența contabilă)",
          ],
          [
            "Rezervările tale și istoricul prezențelor",
            "Rezervarea locului la clasă și scăderea ședințelor din abonament",
            "Executarea contractului",
          ],
          [
            "Jurnalul scanărilor la intrare (data, ora, rezultatul, tableta folosită)",
            "Securitatea accesului și verificarea prezențelor contestate",
            "Interes legitim (art. 5 alin. (1) lit. f)",
          ],
          [
            "Numele și anul nașterii copilului tău, dacă îl înscrii la grupele de copii",
            "Înscrierea copilului la clasă și evidența prezenței lui",
            "Executarea contractului, încheiat de tine în calitate de părinte/reprezentant legal",
          ],
          [
            "Notițe ale recepției (de ex. accidentări sau restricții medicale), DACĂ ni le comunici",
            "Adaptarea antrenamentului la starea ta de sănătate",
            "Consimțământul tău explicit (categorie specială de date)",
          ],
          [
            "Rezervările fără cont: nume, telefon, clasa aleasă",
            "Rezervarea locului atunci când nu ai încă un cont",
            "Executarea contractului / demersuri precontractuale",
          ],
        ],
      },
    },
    {
      heading: "3. Date privind sănătatea",
      paragraphs: [
        "Dacă ne comunici o accidentare, o afecțiune sau o restricție medicală, aceasta este o categorie specială de date, protejată suplimentar de lege.",
        "Le notăm doar dacă ni le spui tu, le folosim exclusiv pentru a-ți adapta antrenamentul, iar accesul la ele îl are numai personalul care are nevoie de ele. Nu ești obligat să ni le comunici, iar dacă ceri ștergerea lor, le ștergem fără ca acest lucru să îți afecteze abonamentul.",
      ],
    },
    {
      heading: "4. Datele copiilor",
      paragraphs: [
        "Pentru grupele de copii prelucrăm numele și anul nașterii copilului. Contul aparține întotdeauna părintelui sau reprezentantului legal, care încheie contractul și își exercită drepturile în numele copilului. Copilul nu are cont propriu și nu i se cere adresă de email sau telefon.",
      ],
    },
    {
      heading: "5. Cui transmitem datele",
      paragraphs: [
        "Nu vindem datele tale și nu le transmitem în scopuri de marketing ale altor companii. Le prelucrăm prin următorii furnizori, care acționează ca persoane împuternicite:",
      ],
      bullets: [
        "Supabase — găzduirea bazei de date și autentificarea contului.",
        "Vercel — găzduirea site-ului.",
        "Meta (Facebook) — doar dacă accepți statisticile: pixelul Meta ne arată câți vizitatori ajung pe site din reclame. Acest transfer se face în afara Republicii Moldova și îl poți refuza (vezi secțiunea 6).",
        "Autorități publice — numai la cererea lor legală întemeiată.",
      ],
    },
    {
      heading: "6. Cookie-uri și statistici",
      paragraphs: [
        "Folosim cookie-uri strict necesare pentru funcționarea site-ului: menținerea sesiunii după autentificare, limba aleasă și sala selectată. Acestea nu pot fi dezactivate, pentru că fără ele site-ul nu funcționează, și nu sunt folosite pentru urmărire.",
        "Separat, folosim pixelul Meta pentru a măsura eficiența reclamelor. Acesta se încarcă NUMAI dacă îți dai acordul în bannerul afișat la prima vizită. Dacă refuzi, pixelul nu se încarcă deloc. Îți poți schimba oricând opțiunea din subsolul paginii.",
      ],
    },
    {
      heading: "7. Cât timp păstrăm datele",
      bullets: [
        "Contul și datele de contact: pe durata în care ești membru și 3 ani după ultima activitate.",
        "Abonamente, plăți și documente contabile: 5 ani, conform legislației contabile și fiscale.",
        "Rezervări și istoricul prezențelor: 3 ani.",
        "Jurnalul scanărilor la intrare: 12 luni.",
        "Notițele medicale: până când ceri ștergerea lor sau până la închiderea contului.",
        "Rezervările fără cont, nerevendicate: 12 luni.",
      ],
    },
    {
      heading: "8. Drepturile tale",
      paragraphs: ["Conform Legii nr. 195/2024 ai următoarele drepturi:"],
      bullets: [
        "Dreptul de acces — să afli ce date deținem despre tine și să primești o copie.",
        "Dreptul la rectificare — să corectăm datele greșite sau incomplete.",
        "Dreptul la ștergere („dreptul de a fi uitat”) — în condițiile prevăzute de lege.",
        "Dreptul la restricționarea prelucrării.",
        "Dreptul la portabilitatea datelor — să primești datele într-un format care poate fi citit automat.",
        "Dreptul de opoziție — inclusiv față de prelucrarea bazată pe interesul nostru legitim.",
        "Dreptul de a-ți retrage consimțământul oricând, fără ca aceasta să afecteze legalitatea prelucrării de dinainte de retragere.",
      ],
    },
    {
      heading: "9. Cum îți exerciți drepturile",
      paragraphs: [
        `Scrie-ne la ${OPERATOR.email || "«[email de contact]»"} sau vino la recepție. Îți răspundem în cel mult 30 de zile. Dacă cererea este complexă, te anunțăm și putem prelungi termenul, explicându-ți motivul.`,
        "Pentru a proteja datele tale, este posibil să te rugăm să îți confirmi identitatea înainte de a da curs cererii.",
      ],
    },
    {
      heading: "10. Dreptul de a depune o plângere",
      paragraphs: [
        "Dacă apreciezi că ți-am încălcat drepturile, te poți adresa Centrului Național pentru Protecția Datelor cu Caracter Personal (CNPDCP): centru@datepersonale.md, telefon (022) 820 801, datepersonale.md. Te poți adresa și instanței de judecată.",
      ],
    },
    {
      heading: "11. Securitatea datelor",
      paragraphs: [
        "Accesul la datele membrilor este limitat la personalul care are nevoie de el, prin conturi individuale și reguli de acces aplicate la nivelul bazei de date. Conexiunea cu site-ul este criptată. Codul QR de acces este personal — nu îl împărtăși altcuiva, pentru că oricine îl prezintă la tabletă poate fi înregistrat ca prezent în locul tău.",
        "Dacă are loc o încălcare a securității datelor care îți poate afecta drepturile, notificăm Centrul Național pentru Protecția Datelor cu Caracter Personal și, atunci când legea o cere, te anunțăm și pe tine.",
      ],
    },
    {
      heading: "12. Decizii automate",
      paragraphs: [
        "Nu luăm decizii cu efect juridic asupra ta exclusiv prin mijloace automate și nu facem profilare. Verificarea automată de la intrare (dacă abonamentul tău este valabil) doar aplică regulile abonamentului pe care l-ai cumpărat; recepția poate interveni oricând manual.",
      ],
    },
    {
      heading: "13. Modificări ale acestei politici",
      paragraphs: [
        "Dacă modificăm această politică, publicăm versiunea nouă pe această pagină și actualizăm data de la începutul ei. Pentru modificări importante te anunțăm direct.",
      ],
    },
  ],
};

const ru: PrivacyDoc = {
  title: "Политика конфиденциальности",
  updated: `Последнее обновление: 1 сентября 2026 г.`,
  intro: [
    "Эта политика объясняет, какие персональные данные мы собираем, зачем, как долго храним и какие у вас есть права.",
    "Она составлена в соответствии с Законом № 195/2024 о защите персональных данных, действующим в Республике Молдова с 23 августа 2026 года. Этот закон переносит в национальное право Регламент (ЕС) 2016/679 (GDPR) и отменяет Закон № 133/2011.",
  ],
  sections: [
    {
      heading: "1. Кто является оператором",
      paragraphs: [
        `Оператор данных — ${OPERATOR.legalName || "«[юридическое название]»"}, IDNO ${OPERATOR.idno || "«[IDNO]»"}, юридический адрес: ${OPERATOR.registeredAddress || "«[юридический адрес]»"} (далее «Dellys», «мы»).`,
        `Связаться с нами можно по адресу ${OPERATOR.email || "«[контактный email]»"} или по телефону ${OPERATOR.phone}.`,
        `Наши залы: ${OPERATOR.sites.join(" · ")}.`,
      ],
    },
    {
      heading: "2. Какие данные мы собираем и зачем",
      paragraphs: [
        "Мы собираем только то, что необходимо для оформления абонемента и доступа на занятия. Таблица ниже отражает именно то, что хранится в нашей системе.",
      ],
      table: {
        head: ["Категория данных", "Цель", "Правовое основание"],
        rows: [
          [
            "Имя, email, телефон, язык, зал",
            "Создание и ведение вашего аккаунта; вход по ссылке, отправленной на email",
            "Исполнение договора",
          ],
          ["Ваш QR-код", "Идентификация на входе в зал, на планшете", "Исполнение договора"],
          [
            "Абонемент: тип, остаток занятий, дата начала и окончания, сумма и способ оплаты",
            "Учёт абонемента и использованных занятий; бухгалтерские обязательства",
            "Исполнение договора; требование закона",
          ],
          [
            "Ваши записи и история посещений",
            "Бронирование места и списание занятий",
            "Исполнение договора",
          ],
          [
            "Журнал сканирований на входе (дата, время, результат, планшет)",
            "Безопасность доступа и проверка спорных посещений",
            "Законный интерес",
          ],
          [
            "Имя и год рождения ребёнка, если вы записываете его в детские группы",
            "Запись ребёнка на занятие и учёт его посещений",
            "Исполнение договора, заключённого вами как родителем/законным представителем",
          ],
          [
            "Заметки ресепшена (например, травмы или медицинские ограничения), ЕСЛИ вы их сообщаете",
            "Адаптация тренировки к состоянию вашего здоровья",
            "Ваше явное согласие (особая категория данных)",
          ],
          [
            "Записи без аккаунта: имя, телефон, выбранное занятие",
            "Бронирование места, когда аккаунта ещё нет",
            "Исполнение договора / преддоговорные действия",
          ],
        ],
      },
    },
    {
      heading: "3. Данные о здоровье",
      paragraphs: [
        "Если вы сообщаете нам о травме, заболевании или медицинском ограничении, это особая категория данных, которая защищена законом дополнительно.",
        "Мы записываем их только с ваших слов, используем исключительно для адаптации тренировки, и доступ к ним имеет только персонал, которому они нужны. Вы не обязаны их сообщать, а если попросите удалить — удалим, и на ваш абонемент это не повлияет.",
      ],
    },
    {
      heading: "4. Данные детей",
      paragraphs: [
        "Для детских групп мы обрабатываем имя и год рождения ребёнка. Аккаунт всегда принадлежит родителю или законному представителю, который заключает договор и осуществляет права от имени ребёнка. У ребёнка нет собственного аккаунта, email и телефон у него не запрашиваются.",
      ],
    },
    {
      heading: "5. Кому мы передаём данные",
      paragraphs: [
        "Мы не продаём ваши данные и не передаём их для маркетинга других компаний. Мы работаем со следующими поставщиками, которые действуют как обработчики:",
      ],
      bullets: [
        "Supabase — хостинг базы данных и аутентификация.",
        "Vercel — хостинг сайта.",
        "Meta (Facebook) — только если вы согласились на статистику: пиксель Meta показывает, сколько посетителей приходит с рекламы. Эта передача происходит за пределы Республики Молдова, и от неё можно отказаться (см. раздел 6).",
        "Государственные органы — только по обоснованному законному запросу.",
      ],
    },
    {
      heading: "6. Файлы cookie и статистика",
      paragraphs: [
        "Мы используем строго необходимые cookie: сохранение сессии после входа, выбранный язык и выбранный зал. Их нельзя отключить, потому что без них сайт не работает, и они не используются для слежения.",
        "Отдельно мы используем пиксель Meta для оценки эффективности рекламы. Он загружается ТОЛЬКО если вы дали согласие в баннере при первом посещении. Если вы отказались, пиксель не загружается вовсе. Изменить выбор можно в любой момент в нижней части страницы.",
      ],
    },
    {
      heading: "7. Сколько мы храним данные",
      bullets: [
        "Аккаунт и контактные данные: пока вы участник и 3 года после последней активности.",
        "Абонементы, платежи и бухгалтерские документы: 5 лет согласно бухгалтерскому и налоговому законодательству.",
        "Записи и история посещений: 3 года.",
        "Журнал сканирований на входе: 12 месяцев.",
        "Медицинские заметки: пока вы не попросите удалить или до закрытия аккаунта.",
        "Невостребованные записи без аккаунта: 12 месяцев.",
      ],
    },
    {
      heading: "8. Ваши права",
      paragraphs: ["Согласно Закону № 195/2024 у вас есть следующие права:"],
      bullets: [
        "Право на доступ — узнать, какие данные у нас есть, и получить копию.",
        "Право на исправление неточных или неполных данных.",
        "Право на удаление («право быть забытым») — в предусмотренных законом случаях.",
        "Право на ограничение обработки.",
        "Право на переносимость данных — получить их в машиночитаемом формате.",
        "Право на возражение — в том числе против обработки на основании нашего законного интереса.",
        "Право отозвать согласие в любой момент; это не влияет на законность обработки до отзыва.",
      ],
    },
    {
      heading: "9. Как воспользоваться правами",
      paragraphs: [
        `Напишите нам на ${OPERATOR.email || "«[контактный email]»"} или подойдите на ресепшен. Мы отвечаем не позднее 30 дней. Если запрос сложный, мы сообщим вам и можем продлить срок, объяснив причину.`,
        "Чтобы защитить ваши данные, мы можем попросить подтвердить личность перед выполнением запроса.",
      ],
    },
    {
      heading: "10. Право подать жалобу",
      paragraphs: [
        "Если вы считаете, что мы нарушили ваши права, вы можете обратиться в Национальный центр по защите персональных данных (CNPDCP): centru@datepersonale.md, телефон (022) 820 801, datepersonale.md. Вы также вправе обратиться в суд.",
      ],
    },
    {
      heading: "11. Безопасность данных",
      paragraphs: [
        "Доступ к данным участников ограничен персоналом, которому он необходим, через индивидуальные учётные записи и правила доступа на уровне базы данных. Соединение с сайтом шифруется. QR-код персональный — не передавайте его другим, поскольку любой, кто предъявит его на планшете, может быть отмечен как присутствующий вместо вас.",
        "Если произойдёт нарушение безопасности данных, способное затронуть ваши права, мы уведомим Национальный центр по защите персональных данных, а когда этого требует закон — и вас.",
      ],
    },
    {
      heading: "12. Автоматические решения",
      paragraphs: [
        "Мы не принимаем решений с юридическими последствиями исключительно автоматически и не занимаемся профилированием. Автоматическая проверка на входе (действителен ли абонемент) лишь применяет правила купленного вами абонемента; ресепшен всегда может вмешаться вручную.",
      ],
    },
    {
      heading: "13. Изменения политики",
      paragraphs: [
        "Если мы изменим эту политику, новая версия будет опубликована на этой странице с обновлённой датой. О существенных изменениях мы сообщим напрямую.",
      ],
    },
  ],
};

export function privacyDoc(lang: Locale): PrivacyDoc {
  return lang === "ru" ? ru : ro;
}
