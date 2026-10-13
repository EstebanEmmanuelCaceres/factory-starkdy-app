import { useFormContext, useWatch } from "react-hook-form"
import { OrderFormValues, getInitials } from "./Types"
import { PriorityField } from "./PriorityField"

export const OrderBar = ({ onChangeClient }: { onChangeClient: () => void }) => {

    const { register, control, formState: { errors } } = useFormContext<OrderFormValues>()
    const client = useWatch({ control, name: 'client' })

    return (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {/* cliente asignado */}
            <div className="flex items-center justify-center gap-[12px] pr-[10px] pl-[14px] py-1 bg-[#0f192b] border border-[#1b263d] rounded-[12px]">
                <div className="h-10 w-10 shrink-0 place-items-center rounded-full bg-[#193a81]  font-bold text-white grid text-[14px]">{getInitials(client?.nombre_cliente)}</div>
                <div className="flex flex-col min-w-0 flex-1">
                    <label className="text-[10px] font-bold tracking-[.1em] uppercase text-[#8390ab]">Cliente asignado</label>
                    <p className='font-bold whitespace-nowrap overflow-hidden text-ellipsis text-[14px]' >{client?.nombre_cliente}</p>
                    <p className='text-[#a8b3c8] text-[12px]'>{client?.nombre_empresa}</p>
                </div>
                <button type="button" onClick={onChangeClient} className="shrink-0 border-0 bg-transparent px-[6px] py-2 rounded-lg text-[13px] font-semibold text-[#9db9f6] cursor-pointer">Cambiar</button>
            </div>
            {/*selector fechas de entrega */}
            <div className="flex flex-col items-start justify-center gap-[10px]">
                <label className="text-[11px] font-bold tracking-[.1em] uppercase text-[#a8b3c8]">Entrega estimada</label>
                <input type="date" className='w-full h-[44px] px-[14px] rounded-[10px] border border-[#2a3a59] bg-[#08101d] text-[#e7ecf5] font-[inherit] text-[14px] outline-none transition-[border-color,box-shadow] duration-150 [color-scheme:dark]' {...register('deliveryDate', { required: "Elegí una fecha de entrega" })} />
            </div>
            <PriorityField />
            <div className="flex flex-col gap-2">
                <div className="flex items-baseline justify-between">
                    <label className="text-[#a8b3c8] text-[11px] font-bold tracking-[.08em] uppercase">Comentario</label>
                    <span className="text-xs text-[#8390ab]">Opcional</span>
                </div>
                <textarea
                    id="f-com"
                    rows={1}
                    placeholder="Notas generales del pedido…"
                    className='w-full h-[44px] rounded-[10px] border border-[#2a3a59] bg-[#08101d] text-[#e7ecf5] font-[inherit] text-[14px] outline-none transition-[border-color,box-shadow] duration-150 [color-scheme:dark] min-h-11 resize-y py-[11px] px-[14px] leading-[1.45]'
                    {...register('comment')}
                />
            </div>
        </section>
    )
}