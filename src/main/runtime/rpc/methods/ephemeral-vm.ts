import { getAppEnvironment } from '../../../../shared/app-environment'
import { runEphemeralVmProvisionRequest } from '../../ephemeral-vm-provision-requests'
import { getEphemeralVmHost } from '../../ephemeral-vm-host-registry'
import { defineMethod, defineStreamingMethod } from '../core'
import {
  EphemeralVmRepo,
  EphemeralVmRecipe,
  EphemeralVmProvision,
  EphemeralVmProvisionId,
  EphemeralVmRuntime,
  EphemeralVmWorkspace,
  EphemeralVmAttach
} from '../../../../shared/rpc-contract/ephemeral-vm-params'

let subscriptionSequence = 0

export const EPHEMERAL_VM_METHODS = [
  defineStreamingMethod({
    name: 'ephemeralVm.provisionEvents',
    params: EphemeralVmProvisionId,
    handler: async ({ provisionId }, { runtime, connectionId, signal }, emit) => {
      await new Promise<void>((resolve) => {
        const unsubscribe = getEphemeralVmHost().onProvisionEvent((event) => {
          if (event.provisionId === provisionId) {
            emit(event)
          }
        })
        const subscriptionId = `ephemeral-vm-${connectionId ?? 'inproc'}-${++subscriptionSequence}`
        const close = () => {
          unsubscribe()
          resolve()
        }
        runtime.registerSubscriptionCleanup(subscriptionId, close, connectionId)
        signal?.addEventListener('abort', () => runtime.cleanupSubscription(subscriptionId), {
          once: true
        })
        if (signal?.aborted) {
          runtime.cleanupSubscription(subscriptionId)
        } else {
          emit({ type: 'ready', subscriptionId })
        }
      })
    }
  }),
  defineMethod({
    name: 'ephemeralVm.listRecipes',
    params: EphemeralVmRepo,
    handler: (params) => getEphemeralVmHost().listRecipes(params)
  }),
  defineMethod({
    name: 'ephemeralVm.listRecipeCatalog',
    params: null,
    handler: () => getEphemeralVmHost().listRecipeCatalog()
  }),
  defineMethod({
    name: 'ephemeralVm.doctor',
    params: EphemeralVmRecipe,
    handler: (params) => getEphemeralVmHost().doctor(params)
  }),
  defineMethod({
    name: 'ephemeralVm.provision',
    params: EphemeralVmProvision,
    handler: (params) =>
      runEphemeralVmProvisionRequest(getAppEnvironment().getPath('userData'), params, async () =>
        getEphemeralVmHost().provision(params)
      )
  }),
  defineMethod({
    name: 'ephemeralVm.cancelProvision',
    params: EphemeralVmProvisionId,
    handler: (params) => getEphemeralVmHost().cancelProvision(params)
  }),
  defineMethod({
    name: 'ephemeralVm.listRuntimes',
    params: null,
    handler: () => getEphemeralVmHost().listRuntimes()
  }),
  defineMethod({
    name: 'ephemeralVm.attachWorkspace',
    params: EphemeralVmAttach,
    handler: (params) => getEphemeralVmHost().attachWorkspace(params)
  }),
  defineMethod({
    name: 'ephemeralVm.cleanup',
    params: EphemeralVmRuntime,
    handler: (params) => getEphemeralVmHost().cleanup(params)
  }),
  defineMethod({
    name: 'ephemeralVm.stopCleanup',
    params: EphemeralVmRuntime,
    handler: (params) => getEphemeralVmHost().stopCleanup(params)
  }),
  defineMethod({
    name: 'ephemeralVm.suspendWorkspace',
    params: EphemeralVmWorkspace,
    handler: (params) => getEphemeralVmHost().suspendWorkspace(params)
  }),
  defineMethod({
    name: 'ephemeralVm.resumeWorkspace',
    params: EphemeralVmWorkspace,
    handler: (params) => getEphemeralVmHost().resumeWorkspace(params)
  }),
  defineMethod({
    name: 'ephemeralVm.getCleanupCommand',
    params: EphemeralVmRuntime,
    handler: (params) => getEphemeralVmHost().getCleanupCommand(params)
  })
] as const
