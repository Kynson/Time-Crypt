
# Time Crypt

This is a PoC of a time based encrytion lock. The encrypted file can only be decrypted after the specified time.

> WARNING: The security of the implementation/ algorithm is NOT guaranteed. DO NOT use in production.

## API Overview

The `/key` endpoint provide the current key for decrytion. A new key will be generated every 30 seconds.

The `/encrypt` endpoint encrypts the `data` (encoded in hex) param with a key in the "future" based on the `t` (UNIX Timestamp) param. The IV should also be provided with the `iv` param. The data can be decrypted when current time > t. The corrsponding key can be retrieved with the `/key` endpoint.

## Algorithm

### Random Sequence (For both salt and encryption key)

1.  Server generate a "genesis"  **secret**  seed
2.  Record the start time
3.  Calculate a random number based on the seed (with `isaacCSPRNG`)
4.  Join (2) and the number of round elapsed from the start time
5.  Hash (4) using  `SHA-512`  and output
6.  If the round is increased: update the seed with (5)
7.  Go to (3)

### Encryption

1.  Find the of round elapsed from the start time when it is time to decrypt
2.  Get the corresponding term of the key random sequence based on (1)
3.  Derive a key from (2) using  `PBKDF2`
4.  Get the corresponding term of the salt random sequence based on (1)
5.  Encrypt the data with (3) as key and (4) as salt using  `AES-256`
