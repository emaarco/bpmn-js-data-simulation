import { Camunda7Engine } from './camunda7/Camunda7Engine.js'
import { ZeebeEngine } from './zeebe/ZeebeEngine.js'

export const zeebeEngine = new ZeebeEngine()
export const camunda7Engine = new Camunda7Engine()
