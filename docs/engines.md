# Engines

| `engine`   | Mappings              | Expression language                                                           |
| ---------- | --------------------- | ----------------------------------------------------------------------------- |
| `zeebe`    | `zeebe:ioMapping`     | FEEL (`=`-prefixed), evaluated with [feelin](https://github.com/nikku/feelin) |
| `camunda7` | `camunda:inputOutput` | JUEL subset; also covers Operaton and CIB seven                               |

Each adapter knows its engine's mapping format and expression language. The routing, the scenarios and the variables are engine-neutral.

## Where the engines differ

- **Task results:** in Zeebe, task results reach the process only when the task has no output mappings. In Camunda 7 they always do, and output parameters are applied on top.
- **Targets:** a Zeebe target such as `order.total` writes a nested variable; a Camunda 7 name is used as is.
- **Temporal values:** FEEL dates, times and durations are stored as ISO strings, as Zeebe does. A later condition has to convert them back, e.g. `date(due) > today()`.
- **Conditions:** a Zeebe condition has to be a FEEL expression starting with `=`.

## Gateways

Exclusive gateways take the first flow whose condition is true, inclusive gateways every such flow; otherwise the default flow is taken. If no flow matches, or a condition fails or is not a boolean (an incident in the engine), the token waits at the gateway, marked red, until you fix the variables and press ▶ on the gateway.

A gateway with a condition the adapter cannot evaluate keeps the token simulation's click-to-choose behavior.

## Conditional flows on activities

An activity whose outgoing flows carry conditions (or that has a default flow) works as an implicit gateway in Camunda 7, and the simulation follows the engine:

- every flow whose condition is true is taken, so two true conditions start two tokens
- a flow without a condition is always taken
- the default flow is taken only when nothing else is
- if nothing can be taken, or a condition fails, the token waits at the activity, marked red, until you fix the variables and press ▶ on the activity; the mappings of the activity are not applied again

Zeebe rejects a model with conditions on flows that leave an activity when it is deployed ("Conditional sequence flows are only supported at exclusive or inclusive gateway"). The token therefore stops at such an activity, and its card says so: the diagram does not suggest a path the engine never runs. A default flow on a Zeebe activity without conditions is ignored, as in Zeebe.

An activity with a condition the adapter cannot evaluate, e.g. a script, keeps the token simulation's behavior and leaves through every flow.

## JUEL subset

Supported: literals, variables, property access (`a.b`, `a['b']`, `list[0]`), comparison (`== != < > <= >=`, `eq ne lt gt le ge`), logic (`&& || !`, `and or not`), arithmetic (`+ - * / %`, `div mod`), `empty` and `?:`. Null values follow EL: a property of null is null, a comparison with null is false.

Not evaluated: method calls (`execution.getVariable(…)`) and script conditions; those gateways fall back to the click.

## Adding an engine

An engine is one `EngineAdapter` (`src/engines/types.ts`): it reads the mappings, conditions and multi-instance loops from the moddle elements and evaluates expressions. `activityConditionRefusal` is the reason an engine rejects conditional flows on activities; leave it out when the engine evaluates them. `readLoop` is optional; without it, a multi-instance activity runs once, as in the plain token simulation. Pass an adapter object (e.g. an instance of your own class) as `engine`, or add it to `src/engines/` (see [CONTRIBUTING.md](../CONTRIBUTING.md)).
