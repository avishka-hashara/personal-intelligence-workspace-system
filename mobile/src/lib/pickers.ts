import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';

/** Promise wrapper around the native Android date/time dialogs. Resolves null when dismissed. */
export function pick(mode: 'date' | 'time', value: Date): Promise<Date | null> {
  return new Promise((resolve) => {
    DateTimePickerAndroid.open({
      value,
      mode,
      is24Hour: true,
      onValueChange: (_event, date) => resolve(date),
      onDismiss: () => resolve(null),
    });
  });
}

/** Date then time; keeps the original time-of-day if the time dialog is dismissed. */
export async function pickDateTime(value: Date): Promise<Date | null> {
  const date = await pick('date', value);
  if (!date) return null;
  const time = await pick('time', date);
  const result = new Date(date);
  if (time) result.setHours(time.getHours(), time.getMinutes(), 0, 0);
  return result;
}
