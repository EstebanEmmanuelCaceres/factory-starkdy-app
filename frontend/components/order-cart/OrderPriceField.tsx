'use client'

import { useFormContext, useWatch } from 'react-hook-form'
import { OrderFormValues, getOrderTotal } from './Types'

const money = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 2 })

/**
 * Precio final del pedido, editable a gusto. Vacío = se cobra lo calculado con los productos,
 * que siempre queda a la vista como referencia.
 */
export const OrderPriceField = () => {
    const { register, setValue, control, formState: { errors } } = useFormContext<OrderFormValues>()
    const lines = useWatch({ control, name: 'lines' })
    const discount = useWatch({ control, name: 'discount' })
    const priceOverride = useWatch({ control, name: 'priceOverride' })
    const calculated = getOrderTotal(lines, discount)
    const isManual = priceOverride !== null

    return (
        <div className='flex flex-col gap-2 p-3.5 border border-[#2a3a59] rounded-[12px] bg-[#0f192b]'>
            <div className='flex items-baseline justify-between gap-2'>
                <label htmlFor='order-price' className='text-[12px] font-bold uppercase tracking-[.08em] text-[#a8b3c8]'>Precio del pedido</label>
                {isManual && (
                    <button
                        type='button'
                        onClick={() => setValue('priceOverride', null, { shouldDirty: true, shouldValidate: true })}
                        className='text-[12px] font-semibold text-[#9db9f6] hover:underline cursor-pointer'
                    >
                        Usar el calculado
                    </button>
                )}
            </div>
            <div className='flex items-center gap-2 h-[44px] px-[14px] rounded-[10px] border border-[#2a3a59] bg-[#08101d] focus-within:border-[#2563eb]'>
                <span className='text-[#a8b3c8]'>$</span>
                <input
                    id='order-price'
                    type='number'
                    min={0}
                    step='0.01'
                    // Sin valor manual se ve el calculado como placeholder
                    placeholder={calculated.toFixed(2)}
                    className='w-full h-full bg-transparent outline-none text-[16px] font-bold text-[#e7ecf5] placeholder:text-[#e7ecf5]/60 tabular-nums [appearance:textfield]'
                    {...register('priceOverride', {
                        setValueAs: (v) => (v === '' || v == null ? null : Number(v)),
                        validate: (v) => v === null || v >= 0 || 'El precio no puede ser negativo',
                    })}
                />
            </div>
            <p className='text-[12px] text-[#8390ab]'>
                Según productos: <span className='font-semibold text-[#a8b3c8] tabular-nums'>{money.format(calculated)}</span>
                {isManual && priceOverride !== calculated && ' · se cobra el precio cargado'}
            </p>
            {errors.priceOverride && <p className='text-[12px] text-rose-400'>{errors.priceOverride.message}</p>}
        </div>
    )
}
