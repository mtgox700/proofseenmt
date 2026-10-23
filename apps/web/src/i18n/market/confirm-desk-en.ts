import type { ConfirmDeskDictionary } from "./confirm-desk-fr";

export const confirmDeskEn: ConfirmDeskDictionary = {
  ack: {
    label: "Decision recorded",
    confirmedTitle: (role: string) => `Mission "${role}" confirmed`,
    refusedTitle: (role: string) => `Mission "${role}" declined`,
    seal: {
      company: (d: string) => `Confirmed by the client on ${d}`,
      contact: (d: string) => `Confirmed by a contact at the client on ${d}`,
    },
    source: "Source",
    by: "Verified by",
    sourceValue: "Client confirmation",
    byValue: { company: "The client, from its account", contact: "A contact at the client, through a signed link" },
    sealLead: "The mission now carries this mark on the freelancer's profile, with this date:",
    published: (ref: string) => `It shows on the public page of ${ref} for as long as that profile is published.`,
    refusedOn: (d: string) => `Declined on ${d}: nothing is published.`,
    contactDone: "There is nothing else to do.",
  },
  pending: {
    title: "Waiting for your answer",
    state: "Pending",
    count: (n: number) => (n === 1 ? `${n} request` : `${n} requests`),
    none: "No pending request.",
    noneElse: "No other pending request.",
  },
  todo: {
    title: "To handle",
    lead: (organisation: string) => `For ${organisation}, counted when this page opened.`,
    confirmations: (n: number) => (n === 1 ? "mission confirmation pending" : "mission confirmations pending"),
    soonest: (d: string) => `The first one expires on ${d}`,
    toSign: (n: number) => (n === 1 ? "contract waiting for your signature" : "contracts waiting for your signature"),
    toPay: (n: number) => (n === 1 ? "contract to pay into escrow" : "contracts to pay into escrow"),
    unread: (n: number) => (n === 1 ? "application nobody has opened yet" : "applications nobody has opened yet"),
    adminsOnly: (organisation: string) => `At ${organisation}, confirming a mission, signing and paying a contract are for the administrators.`,
  },
};
