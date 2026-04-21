/**
 * ESC/POS XML Templates for Wrap & Roll
 * Designed for 80mm thermal paper (approx 42-48 chars wide)
 */

export const CASHIER_RECEIPT_TEMPLATE = `
<document>
  <align mode="center">
    <bold>
      <text-line>WRAP &amp; ROLL</text-line>
    </bold>
    <text-line>Freshly Wrapped Goodness</text-line>
    <line-feed />
    <text-line>Order #{{shortOrderId}}</text-line>
    <text-line>{{placedAt}}</text-line>
  </align>

  <line-feed />

  {{#each items}}
  <text-line>{{name}} x{{quantity}}</text-line>
  <align mode="left">
    <small>
      {{#each modifiers.lines}}
      <text-line>  {{this}}</text-line>
      {{/each}}
    </small>
  </align>
  <align mode="right">
    <text-line>LKR {{lineTotal}}</text-line>
  </align>
  {{/each}}

  <line-feed />
  <align mode="right">
    <text-line>Subtotal: LKR {{pricing.subtotal}}</text-line>
    {{#if pricing.discountAmount}}
    <text-line>Discount: -LKR {{pricing.discountAmount}}</text-line>
    {{/if}}
      {{#if pricing.deliveryFee}}
    <text-line>Delivery: LKR {{pricing.deliveryFee}}</text-line>
    {{/if}}
    <text-line>Tax: LKR {{pricing.tax}}</text-line>
    <bold>
      <text-line>TOTAL: LKR {{pricing.total}}</text-line>
    </bold>
  </align>

  <line-feed />
  <align mode="center">
    <text-line>Payment: {{payment.method}}</text-line>
    <text-line>Type: {{fulfillment.type}}</text-line>
    <line-feed />
    <text-line>Thank you for rolling with us!</text-line>
  </align>
</document>
`;

export const KITCHEN_TICKET_TEMPLATE = `
<document>
  <align mode="center">
    <bold>
      <text-line>KITCHEN TICKET</text-line>
    </bold>
    <text-line size="1:1">Order #{{shortOrderId}}</text-line>
    {{#if fulfillment.tableNumber}}
    <text-line>Table: {{fulfillment.tableNumber}}</text-line>
    {{/if}}
    <text-line>[{{fulfillment.type}}] - {{kitchen.priority}}</text-line>
  </align>

  <line-feed />

  {{#each items}}
  <bold>
    <text-line>{{name}} x{{quantity}}</text-line>
  </bold>
  <align mode="left">
    {{#each modifiers.lines}}
    <text-line>  {{this}}</text-line>
    {{/each}}
  </align>
  <line-feed />
  {{/each}}

  <line-feed />
  <align mode="center">
    <text-line>{{placedAt}}</text-line>
  </align>
</document>
`;
