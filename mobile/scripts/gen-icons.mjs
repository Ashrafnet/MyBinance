import fs from 'fs'
import zlib from 'zlib'

function crc32(buf) {
  let c = ~0
  const table = []
  for (let n = 0; n < 256; n++) {
    let cv = n
    for (let k = 0; k < 8; k++) cv = cv & 1 ? 0xedb88320 ^ (cv >>> 1) : cv >>> 1
    table[n] = cv
  }
  for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 255] ^ (c >>> 8)
  return ~c >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const td = Buffer.concat([Buffer.from(type), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(td))
  return Buffer.concat([len, td, crc])
}

function png(size) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8
  ihdr[9] = 2
  const rows = []
  for (let y = 0; y < size; y++) {
    const row = Buffer.alloc(1 + size * 3)
    for (let x = 0; x < size; x++) {
      const i = 1 + x * 3
      const dx = x - size / 2
      const dy = y - size / 2
      const on = dx * dx + dy * dy < (size * 0.28) ** 2
      row[i] = on ? 0x3d : 0x0b
      row[i + 1] = on ? 0xd6 : 0x12
      row[i + 2] = on ? 0xc6 : 0x20
    }
    rows.push(row)
  }
  const idat = zlib.deflateSync(Buffer.concat(rows))
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))])
}

fs.mkdirSync('public', { recursive: true })
fs.writeFileSync('public/pwa-192.png', png(192))
fs.writeFileSync('public/pwa-512.png', png(512))
console.log('icons ok')
