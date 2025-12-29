export async function HEAD() {
  return new Response(null, {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin'
    }
  })
}
