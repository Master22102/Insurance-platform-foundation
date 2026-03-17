export const webCaptureTargets = [
  {
    name: "Alaska Contract of Carriage",
    url: "https://www.alaskaair.com/content/legal/contract-of-carriage",
    mode: "rendered_html"
  },

  {
    name: "Lufthansa Conditions of Carriage",
    url: "https://www.lufthansa.com/us/en/conditions-of-carriage",
    mode: "expand_and_capture"
  },

  {
    name: "Marriott Terms of Use",
    url: "https://www.marriott.com/about/terms-of-use.mi",
    mode: "rendered_html"
  },

  {
    name: "Europcar Terms and Conditions",
    url: "https://www.europcar.com/en-us/legal-pages/termsAndConditions",
    mode: "dropdown",
    interactions: {
      selectCountry: "France"
    }
  },

  {
    name: "Royal Caribbean Guest Ticket Contract",
    url: "https://www.royalcaribbean.com/guest-terms/guest-ticket-contract",
    mode: "expand_and_capture"
  }
]