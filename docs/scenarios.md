# Scenarios

A scenario is a named set of start variables and mocked task results. Scenarios live in a JSON file next to the diagram, or in any object you pass to `dataSimulation.scenarios` / `setScenarios`:

```json
{
  "scenarios": [
    {
      "id": "small-order",
      "name": "Small order, good credit",
      "description": "Shown under the scenario picker.",
      "variables": { "orderTotal": 1290, "accessories": ["lock"] },
      "taskResults": {
        "Task_CheckCredit": { "score": 720 }
      }
    }
  ]
}
```

| Key           | Required | Meaning                                                                        |
| ------------- | -------- | ------------------------------------------------------------------------------ |
| `id`          | yes      | Unique within the file                                                         |
| `name`        | no       | Shown in the start dialog, defaults to the id                                  |
| `description` | no       | Shown under the scenario picker                                                |
| `variables`   | no       | Prefill the start dialog                                                       |
| `taskResults` | no       | Keyed by element id: what a job worker or user would complete the element with |

Task results come from the scenario an instance was started with, even if another scenario is picked later. Output mappings read them; how they reach the process variables depends on the engine ([Engines](engines.md)).

An invalid file throws a `ScenarioError` that names the scenario and the key.
