import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, TextField } from '../../app/ui'
import type { Floor, SetType } from './api'
import { Chip, EntityPicker, PickedChip } from './components'
import type { NewSet, PickedEntity } from './draft'

const SET_TYPES: SetType[] = ['solo', 'b2b', 'b2b2b', 'f2f', 'live', 'hybrid']

/** Adds a set to the lineup: pending for everyone else, usable by its creator right away. */
export function AddSetSheet({ floors, onAdd, onCancel }: { floors: Floor[]; onAdd: (set: NewSet) => void; onCancel: () => void }) {
  const { t } = useTranslation()
  const [artists, setArtists] = useState<PickedEntity[]>([])
  const [mcs, setMcs] = useState<PickedEntity[]>([])
  const [type, setType] = useState<SetType | null>(null)
  const [floorId, setFloorId] = useState<string | null>(null)
  const [newFloorName, setNewFloorName] = useState('')

  const addArtist = (artist: PickedEntity) =>
    setArtists((current) => (current.some((a) => a.id === artist.id) ? current : [...current, artist]))
  const inferredType: SetType = artists.length >= 3 ? 'b2b2b' : artists.length === 2 ? 'b2b' : 'solo'
  const effectiveType = type ?? inferredType

  const submit = () => {
    const floorName = newFloorName.trim()
    onAdd({
      id: crypto.randomUUID(),
      type: effectiveType,
      artists,
      mcs,
      floorId,
      newFloor: floorName ? { id: crypto.randomUUID(), name: floorName } : null,
    })
  }

  return (
    <div className="space-y-4 rounded-xl bg-surface-1 p-4">
      <h2 className="font-semibold">{t('checkin.addSet')}</h2>

      <div className="flex flex-wrap gap-2">
        {artists.map((artist) => (
          <PickedChip key={artist.id} entity={artist} onRemove={() => setArtists((current) => current.filter((a) => a.id !== artist.id))} />
        ))}
      </div>
      <EntityPicker type="artist" label={t('checkin.artist')} hint={t('checkin.artistHint')} onPick={addArtist} />

      <div>
        <p className="mb-1 text-sm text-text-secondary">{t('checkin.setType')}</p>
        <div className="flex flex-wrap gap-2">
          {SET_TYPES.map((option) => (
            <Chip key={option} selected={effectiveType === option} onClick={() => setType(option)}>{t(`checkin.setTypes.${option}`)}</Chip>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {mcs.map((mc) => (
          <PickedChip key={mc.id} entity={mc} onRemove={() => setMcs((current) => current.filter((m) => m.id !== mc.id))} />
        ))}
      </div>
      <EntityPicker type="artist" label={t('checkin.mc')} onPick={(mc) => setMcs((current) => [...current, mc])} />

      {floors.length > 0 && (
        <div>
          <p className="mb-1 text-sm text-text-secondary">{t('checkin.floor')}</p>
          <div className="flex flex-wrap gap-2">
            {floors.map((floor) => (
              <Chip key={floor.id} selected={floorId === floor.id} onClick={() => setFloorId(floorId === floor.id ? null : floor.id)}>{floor.name}</Chip>
            ))}
          </div>
        </div>
      )}
      <TextField label={t('checkin.newFloor')} value={newFloorName} onChange={(e) => setNewFloorName(e.target.value)} autoComplete="off" />

      <div className="grid grid-cols-2 gap-2">
        <Button onClick={onCancel}>{t('common.cancel')}</Button>
        <Button variant="primary" disabled={artists.length === 0} onClick={submit}>{t('checkin.addSetConfirm')}</Button>
      </div>
    </div>
  )
}
