import { Legend, PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer, Tooltip } from 'recharts';
import { ResumoGapLob } from '../../types/api';

/**
 * "Perfil atual vs. perfil exigido" (pedido do utilizador): cada eixo é
 * uma LOB, a prontidão já vem normalizada 0-100% pelo motor de gap
 * (RelatorioGapCargo.lobs) — por isso "exigido" é sempre o anel dos
 * 100%, não precisa de outro endpoint. Duas séries (identidade, não
 * magnitude) → cor + traço tracejado + legenda, nunca só a cor.
 */
export function PerfilRadarChart({ lobs }: { lobs: ResumoGapLob[] }) {
  const dados = lobs.map((l) => ({ lob: l.lobNome, Atual: l.prontidaoPercentual, Exigido: 100 }));

  return (
    <div className="h-80 w-full">
      <ResponsiveContainer>
        <RadarChart data={dados} outerRadius="72%">
          <PolarGrid stroke="#D9D9D9" />
          <PolarAngleAxis dataKey="lob" tick={{ fontSize: 11, fill: '#6A6D70' }} />
          <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 10, fill: '#6A6D70' }} tickCount={5} />
          <Radar name="Exigido (100%)" dataKey="Exigido" stroke="#89919A" strokeDasharray="4 3" fill="#89919A" fillOpacity={0.06} />
          <Radar name="Atual" dataKey="Atual" stroke="#0070F2" fill="#0070F2" fillOpacity={0.28} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Tooltip formatter={(v) => `${v}%`} />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
