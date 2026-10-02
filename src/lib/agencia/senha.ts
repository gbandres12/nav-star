import "server-only";
import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

const N = 16384;
const R = 8;
const P = 1;
const TAM = 64;

function derivar(senha: string, salt: Buffer, n = N, r = R, p = P): Promise<Buffer> {
  return new Promise((ok, erro) => scrypt(senha, salt, TAM, { N: n, r, p }, (e, k) => (e ? erro(e) : ok(k))));
}

/** Formato: scrypt$N$r$p$salt$hash (base64) */
export async function hashSenha(senha: string) {
  const salt = randomBytes(16);
  const chave = await derivar(senha, salt);
  return ["scrypt", N, R, P, salt.toString("base64"), chave.toString("base64")].join("$");
}

const SALT_FALSO = Buffer.alloc(16, 1);

/** Sem hash (e-mail inexistente) ainda gasta o mesmo tempo, para o login não revelar quais e-mails existem */
export async function conferirSenha(senha: string, armazenado: string | null | undefined) {
  const partes = armazenado?.split("$");
  if (!partes || partes.length !== 6 || partes[0] !== "scrypt") {
    await derivar(senha, SALT_FALSO);
    return false;
  }
  const [, n, r, p, salt, hash] = partes;
  const esperado = Buffer.from(hash, "base64");
  const obtido = await derivar(senha, Buffer.from(salt, "base64"), Number(n), Number(r), Number(p));
  return esperado.length === obtido.length && timingSafeEqual(esperado, obtido);
}
