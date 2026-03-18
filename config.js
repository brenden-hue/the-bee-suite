window.CRM_CONFIG = {
  supabaseUrl: "YOUR_SUPABASE_URL",
  supabaseAnonKey: "YOUR_SUPABASE_ANON_KEY",

  billingHidden: true,

  views: [
    { id: "overview", label: "Overview" },
    { id: "pipeline", label: "Lead Pipeline" },
    { id: "tours", label: "Tours" },
    { id: "operations", label: "Operations" },
    { id: "parentComms", label: "Parent Comms" },
    { id: "compliance", label: "Compliance" },
    { id: "ai", label: "AI Copilot" }
  ],

  quickFilters: [
    { id: "all", label: "All Data" },
    { id: "orlando", label: "Orlando" },
    { id: "high_intent", label: "High Intent" },
    { id: "needs_reply", label: "Needs Reply" },
    { id: "today", label: "Today" }
  ],

  roleMeta: {
    executive: {
      label: "Executive View",
      title: "Executive Command Center",
      heroTitle: "Portfolio-wide visibility for Kid City USA",
      heroCopy:
        "See enrollment health, center readiness, staffing coverage, parent engagement, and lead flow across the portfolio."
    },
    director: {
      label: "Director View",
      title: "Center Operations Command",
      heroTitle: "Run the center without losing the big picture",
      heroCopy:
        "Watch leads, tours, staffing, parent communication, classroom readiness, and compliance from one screen."
    },
    admissions: {
      label: "Admissions View",
      title: "Admissions Growth Hub",
      heroTitle: "Move families from inquiry to enrollment faster",
      heroCopy:
        "Use the lead pipeline, tour scheduling, follow-up queue, and conversion signals to keep momentum high."
    }
  },

  leadImportTemplateHeaders: [
    "family_name",
    "child_name",
    "child_age",
    "source",
    "location_code",
    "status",
    "tour_state",
    "intent_score",
    "notes",
    "created_at"
  ]
};