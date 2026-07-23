import { Share } from 'react-native';

export async function shareMoment(payload: {
  title: string;
  subtitle: string;
  badge: string;
  category?: string;
  winner?: string;
  predictionLabel?: string;
  actualLabel?: string;
  differenceLabel?: string;
  oracleLabel?: string;
  commentary: string;
  cta: string;
  linkLabel?: string;
}) {
  const text = [
    payload.title,
    payload.subtitle,
    payload.category ? `Category: ${payload.category}` : null,
    payload.winner ? `Winner: ${payload.winner}` : null,
    payload.predictionLabel ? `Predicted: ${payload.predictionLabel}` : null,
    payload.actualLabel ? `Actual: ${payload.actualLabel}` : null,
    payload.differenceLabel ? `Difference: ${payload.differenceLabel}` : null,
    payload.oracleLabel ? `Oracle Bot: ${payload.oracleLabel}` : null,
    payload.badge,
    payload.commentary,
    payload.cta,
    payload.linkLabel ?? 'Join the next Prediktion',
  ].filter(Boolean).join('\n');

  await Share.share({ title: payload.title, message: text });
}
