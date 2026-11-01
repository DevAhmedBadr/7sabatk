
/* =========================================
   7sabatk Brand Content
   SevenX Technologies
   Arabic / English
========================================= */

const BRAND_COPY = {

  ar: {

    navCatalog: "المتجر",

    featuresKicker: "منصة رقمية متكاملة",

    featuresTitle: "كل ما تحتاجه رقميًا في مكان واحد",

    featuresText:
      "تجمع 7sabatk التابعة لشركة SevenX Technologies بين الحسابات الرقمية وخدمات السوشيال ميديا والاشتراكات الرقمية في تجربة واحدة.",

    cards: [

      [
        "الحسابات الرقمية",
        "حسابات منصات التواصل والألعاب مثل TikTok وYouTube وSteam وغيرها."
      ],

      [
        "خدمات السوشيال ميديا",
        "خدمات زيادة المتابعين واللايكات والمشاهدات ودعم نمو الحسابات."
      ],

      [
        "الاشتراكات الرقمية",
        "اشتراكات منصات الترفيه والمحتوى مثل Shahid وNetflix وYouTube وغيرها."
      ]

    ],

    catalogKicker: "اكتشف عروضنا",

    catalogTitle: "العروض الرقمية المتاحة",

    catalogText:
      "تصفح الحسابات والخدمات والاشتراكات المتاحة، وابحث حسب المنصة أو نوع العرض.",

    aboutKicker: "عن SevenX Technologies",

    aboutTitle: "أكثر من مجرد متجر رقمي.",

    aboutText:
      "7sabatk منصة رقمية متكاملة تابعة لشركة SevenX Technologies، تجمع في مكان واحد بيع الحسابات الرقمية وتقديم خدمات السوشيال ميديا والاشتراكات الرقمية. نهدف إلى توفير تجربة واضحة وسهلة لاستكشاف العروض ومقارنة تفاصيلها والتواصل بشأنها. ونعمل على تطوير برنامج للتسويق بالعمولة يتيح للمسوقين الحصول على رصيد مقابل المشتريات التي تتم من خلال روابطهم، وفق شروط البرنامج عند إطلاقه.",

    values: [
      "حسابات رقمية",
      "خدمات السوشيال ميديا",
      "اشتراكات رقمية"
    ],

    contactTitle: "كيف يمكننا مساعدتك؟",

    contactText:
      "تواصل معنا للاستفسار عن الحسابات الرقمية أو خدمات السوشيال ميديا أو الاشتراكات المتاحة على المنصة.",

    contactBtn: "تواصل مع فريقنا",

    heroAlt: "7sabatk — منصة رقمية متكاملة"

  },

  en: {

    navCatalog: "Marketplace",

    featuresKicker: "An all-in-one digital platform",

    featuresTitle: "Everything digital, in one place",

    featuresText:
      "7sabatk by SevenX Technologies brings digital accounts, social media services and digital subscriptions together in one experience.",

    cards: [

      [
        "Digital Accounts",
        "Social media and gaming accounts across platforms such as TikTok, YouTube, Steam and more."
      ],

      [
        "Social Media Services",
        "Services for followers, likes, views and supporting social media account growth."
      ],

      [
        "Digital Subscriptions",
        "Entertainment and content subscriptions such as Shahid, Netflix, YouTube and more."
      ]

    ],

    catalogKicker: "Explore our marketplace",

    catalogTitle: "Available digital offers",

    catalogText:
      "Browse available accounts, services and subscriptions. Search by platform or offer type.",

    aboutKicker: "About SevenX Technologies",

    aboutTitle: "More than a digital marketplace.",

    aboutText:
      "7sabatk is an all-in-one digital platform by SevenX Technologies, bringing digital accounts, social media services and digital subscriptions together. Our goal is to make it easy to explore offers, compare their details and contact us. We are also developing an affiliate programme that can reward promoters with account credit for purchases made through their referral links, subject to the programme terms when launched.",

    values: [
      "Digital Accounts",
      "Social Media Services",
      "Digital Subscriptions"
    ],

    contactTitle: "How can we help?",

    contactText:
      "Contact us with questions about digital accounts, social media services or subscriptions available on the platform.",

    contactBtn: "Contact our team",

    heroAlt: "7sabatk — All-in-One Digital Platform"

  }

};


/* =========================================
   Apply Branding
========================================= */

function apply7sabatkBranding() {

  const language = document.documentElement.lang
    .toLowerCase()
    .startsWith("ar") ? "ar" : "en";

  const copy = BRAND_COPY[language];

  /* Page title */

  document.title = language === "ar"
    ? "7sabatk | منصة رقمية متكاملة"
    : "7sabatk | All-in-One Digital Platform";


  /* Language-based banner */

  const banner = document.getElementById("heroBanner");

  if (banner) {

    banner.src = language === "ar"
      ? "assets/images/banner-ar.png"
      : "assets/images/banner-en.png";

    banner.alt = copy.heroAlt;

  }


  /* Navigation */

  const catalogLink = document.querySelector(
    '.nav-links a[href="#marketplace"]'
  );

  if (catalogLink) {
    catalogLink.textContent = copy.navCatalog;
  }


  /* Features heading */

  const featureHeading = document.querySelector(
    ".features-section .section-heading"
  );

  if (featureHeading) {

    const kicker = featureHeading.querySelector(".section-kicker");
    const title = featureHeading.querySelector("h2");
    const paragraph = featureHeading.querySelector("p");

    if (kicker) kicker.textContent = copy.featuresKicker;
    if (title) title.textContent = copy.featuresTitle;
    if (paragraph) paragraph.textContent = copy.featuresText;

  }


  /* Three main categories */

  document.querySelectorAll(".feature-card").forEach(
    (card, index) => {

      const item = copy.cards[index];

      if (!item) return;

      const title = card.querySelector("h3");
      const paragraph = card.querySelector("p");

      if (title) title.textContent = item[0];
      if (paragraph) paragraph.textContent = item[1];

    }
  );


  /* Marketplace heading */

  const marketplaceHeading = document.querySelector(
    ".marketplace-section .section-heading"
  );

  if (marketplaceHeading) {

    const kicker = marketplaceHeading.querySelector(".section-kicker");
    const title = marketplaceHeading.querySelector("h2");
    const paragraph = marketplaceHeading.querySelector("p");

    if (kicker) kicker.textContent = copy.catalogKicker;
    if (title) title.textContent = copy.catalogTitle;
    if (paragraph) paragraph.textContent = copy.catalogText;

  }


  /* About SevenX Technologies */

  const about = document.querySelector(".about-section");

  if (about) {

    const kicker = about.querySelector(".section-kicker");
    const heading = about.querySelector("h2");
    const paragraph = about.querySelector(".about-copy p");

    if (kicker) kicker.textContent = copy.aboutKicker;

    if (heading) {

      heading.innerHTML = `
        <span data-brand-name>
          ${language === "ar" ? "موقع حساباتك" : "7sabatk"}
        </span>

        <br>

        <span>${copy.aboutTitle}</span>
      `;

    }

    if (paragraph) {
      paragraph.textContent = copy.aboutText;
    }

    about.querySelectorAll(".values span").forEach(
      (element, index) => {

        if (copy.values[index]) {
          element.textContent = copy.values[index];
        }

      }
    );

  }


  /* Contact section */

  const contact = document.querySelector(".contact-panel");

  if (contact) {

    const heading = contact.querySelector("h2");
    const paragraph = contact.querySelector("p");
    const link = contact.querySelector("a");

    if (heading) heading.textContent = copy.contactTitle;
    if (paragraph) paragraph.textContent = copy.contactText;
    if (link) link.textContent = copy.contactBtn;

  }

}


/* =========================================
   Initial Language + Language Changes
========================================= */

apply7sabatkBranding();

const languageObserver = new MutationObserver(() => {
  apply7sabatkBranding();
});

languageObserver.observe(document.documentElement, {
  attributes: true,
  attributeFilter: ["lang"]
});
