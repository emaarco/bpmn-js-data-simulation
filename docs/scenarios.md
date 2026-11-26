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
        "serviceTask_checkCredit": { "score": 720 }
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

## Multi-instance activities

A task or sub-process with the parallel (|||) or sequential (≡) multi-instance marker runs as many instances as the data says. The token simulation alone runs it once.

| Engine    | Read from                                                                       |
| --------- | ------------------------------------------------------------------------------- |
| Zeebe     | `loopCardinality`, else `zeebe:loopCharacteristics inputCollection`             |
| Camunda 7 | `loopCardinality`, else `camunda:collection` (an expression or a variable name) |

- **Parallel:** all instances start at once and finish one by one; the token moves on after the last one.
- **Sequential:** the next instance starts when the previous one is done.
- **Empty collection:** no instance runs and the token moves on.
- **No data:** without a cardinality or collection, or with the data simulation switched off, 3 instances run, so the pattern still shows. If the collection cannot be read (a missing variable, a value that is not a list), 3 instances run too, and **Issues** in the process data panel says why.

A dot per instance above the activity shows it waiting, running or done; its tooltip says where the count came from. The output mappings and task result of the activity apply once, after the last instance. The input element (`inputElement` / `camunda:elementVariable`) is not set, so conditions inside a multi-instance sub-process cannot read it.
