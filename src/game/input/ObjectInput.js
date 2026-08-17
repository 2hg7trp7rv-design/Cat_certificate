export function bindObjectInput(object, handler) {
  const activate = pointer => handler?.({ object, pointer })
  object.on('pointerup', activate)
  return () => object.off('pointerup', activate)
}

export default bindObjectInput
