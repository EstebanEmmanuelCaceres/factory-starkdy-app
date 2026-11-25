'use client'

import { useEffect, useState } from 'react'
import { FormProvider, useForm } from 'react-hook-form'
import { Modal } from '@/components/Modal/Modal'
import { useModal } from '@/components/Modal/context/ModalContext'
import { WizardFooter, WIZARD_FOOTER_SPACE, type WizardFooterAction } from '@/components/WizardFooter'
import { WizardStepper } from '@/components/WizardStep'
import { PriorityField } from '@/components/order-cart/PriorityField'
import type { Pedido } from '@/lib/pedidos'
import { crearReposicion, type Reposicion } from '@/lib/entities/reposiciones'
import { LineasReposicionField } from './LineasReposicionField'
import { MotivoReposicionField } from './MotivoReposicionField'
import { ReposicionResumen } from './ReposicionResumen'
import { ReposicionCreando } from './ReposicionCreando'
import { ReposicionCreada } from './ReposicionCreada'
import { ReposicionFooterSummary } from './ReposicionFooterSummary'
import {
  ETAPAS_REPOSICION,
  buildReposicionPayload,
  valoresIniciales,
  type PasoReposicion,
  type ReposicionFormValues,
} from './types'

export const REPOSICION_MODAL_ID = 'reposicion-pedido'

interface ReposicionModalProps {
  // Pedido a reponer (el que se eligió en la tabla); el modal se abre con useModal(REPOSICION_MODAL_ID).open()
  pedido: Pedido | null
  onCreada?: (reposicion: Reposicion) => void
  onClose?: () => void
}

/**
 * Wizard para reponer un pedido que llegó mal: se eligen qué productos y cuántas unidades
 * se vuelven a hacer (no se agregan productos nuevos), el motivo, la prioridad y la entrega.
 * Pasos: formulario → resumen → creada.
 */
export const ReposicionModal = ({ pedido, onCreada, onClose }: ReposicionModalProps) => {
  const { isOpen, close } = useModal(REPOSICION_MODAL_ID)
  const methods = useForm<ReposicionFormValues>({ defaultValues: valoresIniciales(null) })
  const [paso, setPaso] = useState<PasoReposicion>('formulario')
  const [creada, setCreada] = useState<Reposicion | null>(null)
  const [error, setError] = useState('')

  // Cada vez que se abre arranca de cero con las líneas del pedido elegido.
  // Depende del id y no del objeto: si la página recarga la lista, no se pierde el paso "creada".
  useEffect(() => {
    if (!isOpen) return
    methods.reset(valoresIniciales(pedido))
    setPaso('formulario')
    setCreada(null)
    setError('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, pedido?.id])

  const cerrar = () => {
    // Mientras se crea no se puede cerrar (Escape, fondo o X): hay que esperar la respuesta
    if (paso === 'creando') return
    close()
    onClose?.()
  }

  const crear = methods.handleSubmit(async (values) => {
    if (!pedido) return
    setError('')
    setPaso('creando')
    try {
      // Recién con la respuesta del backend se pasa a "creada"; si falla vuelve al resumen con el error
      const reposicion = await crearReposicion(pedido.id, buildReposicionPayload(values))
      setCreada(reposicion)
      setPaso('creada')
      onCreada?.(reposicion)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'No se pudo crear la reposición')
      setPaso('resumen')
    }
  })

  const acciones: Record<PasoReposicion, { back?: WizardFooterAction; next?: WizardFooterAction; resumen?: boolean }> = {
    formulario: {
      back: { label: 'Cancelar', onClick: cerrar },
      next: {
        label: 'Revisar reposición',
        shortLabel: 'Revisar',
        onClick: methods.handleSubmit(() => {
          setError('')
          setPaso('resumen')
        }),
      },
      resumen: true,
    },
    resumen: {
      back: { label: 'Volver a editar', shortLabel: 'Editar', onClick: () => setPaso('formulario') },
      next: { label: 'Crear reposición', shortLabel: 'Crear', onClick: crear },
      resumen: true,
    },
    creando: {},
    creada: {
      next: { label: 'Finalizar', onClick: cerrar },
    },
  }
  const footer = acciones[paso]

  if (!isOpen || !pedido) return null

  return (
    <FormProvider {...methods}>
      <Modal
        id={REPOSICION_MODAL_ID}
        onClose={cerrar}
        className="h-[90vh]"
        bodyClassName={`[scrollbar-gutter:stable] ${WIZARD_FOOTER_SPACE}`}
        footer={
          paso !== 'creando' && (
            <WizardFooter back={footer.back} next={footer.next}>
              {footer.resumen && <ReposicionFooterSummary />}
            </WizardFooter>
          )
        }
      >
        <div className="relative flex w-full flex-wrap justify-between border-b border-slate-800 pb-4 pr-10 lg:pr-0">
          <div className="min-w-0">
            <h2 className="text-xl font-bold text-white">Reponer pedido {pedido.codigo}</h2>
            <p className="text-[13px] text-[#a8b3c8]">
              {pedido.cliente?.nombre_empresa || pedido.cliente?.nombre_cliente} · se vuelve a hacer sin cargo
            </p>
          </div>
          <WizardStepper currentStep={paso} steps={ETAPAS_REPOSICION} />
        </div>

        {error && (
          <div className="mt-4 flex items-center gap-2 rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
            <span>❌</span>
            <span className="font-semibold">{error}</span>
          </div>
        )}

        {paso === 'formulario' && (
          // Mobile: todo en una columna. Tablet: los campos de la derecha en 2 columnas debajo de las líneas.
          // Desktop: líneas a la izquierda ocupando el ancho libre y los campos en una columna a la derecha.
          <div className="grid w-full grid-cols-1 gap-6 pt-5 lg:grid-cols-[minmax(0,1fr)_minmax(380px,34%)] xl:gap-8">
            <LineasReposicionField pedido={pedido} />
            <aside className="grid grid-cols-1 content-start gap-5 md:grid-cols-2 lg:grid-cols-1">
              <div className="md:col-span-2 lg:col-span-1">
                <MotivoReposicionField />
              </div>
              <PriorityField />
              <div className="flex flex-col gap-2">
                <label htmlFor="entrega-reposicion" className="text-[11px] font-bold uppercase tracking-[.08em] text-[#8390ab]">
                  Entrega estimada
                </label>
                <input
                  id="entrega-reposicion"
                  type="date"
                  className="h-[44px] w-full rounded-[10px] border border-[#2a3a59] bg-[#08101d] px-[14px] text-[14px] text-[#e7ecf5] outline-none [color-scheme:dark] focus:border-[#2563eb]"
                  {...methods.register('deliveryDate', { required: 'Elegí una fecha de entrega' })}
                />
                {methods.formState.errors.deliveryDate && (
                  <p className="text-[12px] text-rose-400">{methods.formState.errors.deliveryDate.message}</p>
                )}
              </div>
            </aside>
          </div>
        )}

        {paso === 'resumen' && <ReposicionResumen pedido={pedido} />}

        {paso === 'creando' && <ReposicionCreando codigo={pedido.codigo} />}

        {paso === 'creada' && creada && <ReposicionCreada reposicion={creada} />}
      </Modal>
    </FormProvider>
  )
}
