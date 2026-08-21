import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "./ui/accordion";

export function PricingFAQ() {
  const faqs = [
    {
      question: "Who is the first version for?",
      answer: "Small staffing, development, and consulting agencies that coordinate workers, suppliers, and client approvers across a recurring monthly timesheet-to-invoice process.",
    },
    {
      question: "Why are counterparty approvers free?",
      answer: "They are part of the workflow, not the buyer. Removing per-seat friction makes it easier for the operating agency to get real suppliers and clients into the approval chain.",
    },
    {
      question: "Does WorkGraph move money or replace accounting software?",
      answer: "Not today. WorkGraph prepares and tracks invoice records from approved work. Payment execution, reconciliation, and accounting-system sync remain with your existing tools during the pilot.",
    },
    {
      question: "Is Croatian e-invoicing already certified?",
      answer: "No. The product stores structured invoice fields and EN 16931-oriented template metadata, but certified Croatian e-invoice XML, fiscalization, and intermediary delivery are still a readiness track—not a current compliance claim.",
    },
    {
      question: "How is cross-company data protected?",
      answer: "The pilot architecture uses database policies, guarded server functions, account-bound approvals, private rate records, and server-scoped graph payloads. Every pilot still receives a security and workflow readiness review before real commercial use.",
    },
  ];

  return (
    <div className="max-w-3xl mx-auto">
      <h3 className="text-center mb-8 text-xl font-semibold">Common questions</h3>
      <Accordion type="single" collapsible className="w-full">
        {faqs.map((faq, index) => (
          <AccordionItem key={faq.question} value={`item-${index}`}>
            <AccordionTrigger className="text-left font-medium">
              {faq.question}
            </AccordionTrigger>
            <AccordionContent className="text-muted-foreground leading-relaxed">
              {faq.answer}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}
