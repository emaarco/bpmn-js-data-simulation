export const orderScenarios = {
  scenarios: [
    {
      id: 'small-order',
      name: 'Small order, good credit',
      variables: { customer: { id: 'C-1' }, orderTotal: 1200, insurance: true, accessories: ['lock'] },
      taskResults: { Task_CheckCredit: { score: 720 } },
    },
    {
      id: 'large-order',
      name: 'Large order, approved in review',
      variables: { customer: { id: 'C-2' }, orderTotal: 8900, insurance: false, accessories: [] },
      taskResults: { Task_CheckCredit: { score: 680 }, Task_Review: { approved: true } },
    },
    {
      id: 'bad-credit',
      name: 'Bad credit',
      variables: { customer: { id: 'C-3' }, orderTotal: 300, insurance: false, accessories: [] },
      taskResults: { Task_CheckCredit: { score: 420 } },
    },
    {
      id: 'missing-total',
      name: 'Order total missing',
      variables: { customer: { id: 'C-4' }, insurance: false, accessories: [] },
      taskResults: { Task_CheckCredit: { score: 720 } },
    },
    {
      id: 'no-credit-result',
      name: 'Credit check returns nothing',
      variables: { customer: { id: 'C-5' }, orderTotal: 100, insurance: false, accessories: [] },
    },
  ],
}
