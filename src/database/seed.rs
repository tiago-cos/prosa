use sqlx::SqlitePool;

pub async fn seed_database(pool: &SqlitePool) {
    // User tables
    sqlx::query(
        r#"
        INSERT INTO users (user_id, password_hash, is_admin) VALUES
        ('Harry', '$argon2id$v=19$m=19456,t=2,p=1$uW+cLdc24XxSpMBWdy51Bg$DHjpjs9M9mfHJvvKV97pM6Gwa0LCsxwAlHS4Q9KmojU', TRUE),
        ('Hermione', '$argon2id$v=19$m=19456,t=2,p=1$ujbV6HiQOOmF1+9uC6imrw$u7nG7iyDAXBTFcnDqS0ybOWVQnrD23gWwgHJAGXoCcU', FALSE),
        ('Ron', '$argon2id$v=19$m=19456,t=2,p=1$x6m5cIyk7t3GDpYkgog9kg$J6oCe2B68BuyjBgxBqDplEomHg1I/vgV8ZTXNZ9RMI8', FALSE),
        ('Albus', '$argon2id$v=19$m=19456,t=2,p=1$uS0OZXMKWN8bUXaKGOd2Gw$4aSRpSryAmf92/i66hPSk3yw3R+JQfG8D9eQMwbEffw', FALSE),
        ('Severus', '$argon2id$v=19$m=19456,t=2,p=1$S68BE3WSmaQZXUxLjyOlVA$LcO/a0VBEzewmx5DrfwQeaViHj7VGSnBbOy6Bcacqv8', FALSE),
        ('Minerva', '$argon2id$v=19$m=19456,t=2,p=1$tjOXWdEuaRot8gS2XleB2g$uODyOXqkxdC1HxwZW0pibuCLDOkHCJ5yf0YWM2+pU00', FALSE),
        ('Rubeus', '$argon2id$v=19$m=19456,t=2,p=1$ZWpIjDvYREfQm2DTua+jUQ$X4gnWnTeK3kiHOqvOw47rHoi03T/waoF5Xi0GoBBZP4', FALSE),
        ('Sirius', '$argon2id$v=19$m=19456,t=2,p=1$NOaWo5iOdszDxXdenBzATw$4dDsDyt4K0lvQxVvYN3xhNO+DPv5i2Mc16RxQnLb2CQ', FALSE),
        ('Remus', '$argon2id$v=19$m=19456,t=2,p=1$toVP3beWxlCSbihzgc8VCQ$MwNJFWUypxleuY5DYrNqnCBQnjpBPJRhLsMnaNmWwu0', FALSE),
        ('Neville', '$argon2id$v=19$m=19456,t=2,p=1$8ULGlzCyThNr/kdzaz5y6w$C6QgYroxmc0+P/Cn+5lcS0fGP0Cid66Uo83eI9Qntow', FALSE),
        ('Luna', '$argon2id$v=19$m=19456,t=2,p=1$GyKmgka5aid/ceAHDVwfxg$vQBzAznj1LWjfI+B35GEAaTr8EOc1gLAUYCP57QrAkQ', FALSE),
        ('Ginny', '$argon2id$v=19$m=19456,t=2,p=1$JlGzfCz3ksdDXoTW45Vfaw$unuc3cle7APj8UJw9y3AhOcKsTkn/+51LJO08vCjq08', FALSE),
        ('Fred', '$argon2id$v=19$m=19456,t=2,p=1$zmxwNGIZHXaMxIZUsS0Afw$n9BEuzNHatC4qoudKtu6fG5woWax/xRT08S05qtscpk', FALSE),
        ('George', '$argon2id$v=19$m=19456,t=2,p=1$QbaskByA3rfmCfc2CsMRFw$nw2tF9QwmMhZZ9/ydfcsdADBSuk8wtrm+dnGteXICjQ', FALSE),
        ('Draco', '$argon2id$v=19$m=19456,t=2,p=1$Ev9hnlxvg4MDxImNNN5Ntw$QZwH+f8I2Ia+n3RLVmK/MAStMb7CewnVyvt3wX960Sg', TRUE),
        ('Lucius', '$argon2id$v=19$m=19456,t=2,p=1$EHu2xqXIl3yiPo8jo3ia1A$+5OZQdfknLg1f5t52nTdakVqBZ+osqanCXHb43a+vyQ', FALSE),
        ('Narcissa', '$argon2id$v=19$m=19456,t=2,p=1$jRZ6b31T7XMwRnk6CcfuFQ$4Jfa6MERScbzqblkIWQdnafgdXS4qkE5z1OC6sIhgPA', FALSE),
        ('Bellatrix', '$argon2id$v=19$m=19456,t=2,p=1$2SvvlVCbWiP8VBDlu7zEQA$//Ldf4/AuDYnoqkCHku9Zdquai0PYHozI1OMjrMSX6Y', FALSE),
        ('Nymphadora', '$argon2id$v=19$m=19456,t=2,p=1$s0Q5pnh/PB7eHipvgQfdCw$4X22DApnkGJIDH9e2lbJadEFI7OIsvnJtkmx2WFv6fI', FALSE),
        ('Cho', '$argon2id$v=19$m=19456,t=2,p=1$2b790ZY3w0Bp2hJeBNdn0g$3QeCd8PA/ObPk3ofQ91yGvoN5D6O6hkSt8DKsE2zpJQ', FALSE),
        ('Cedric', '$argon2id$v=19$m=19456,t=2,p=1$mnd+HC0HagYAo7zekxNwbA$MmwjkrdMBlXRu6oTHKCUj9atjBa4S2+V9ZRuSaBaKkc', FALSE),
        ('Viktor', '$argon2id$v=19$m=19456,t=2,p=1$1Olv49Ls8YDYnI3vKPdkDA$54XjTcXjjfEj5vWvLuoqIegyXo+w9pZ6gmLC2Arq4gM', FALSE),
        ('Fleur', '$argon2id$v=19$m=19456,t=2,p=1$uir6y7CkramTnkXNqQajhg$lna0wskRJeJvNTIk+wifZzVn1VpTMAGAB6N1VhYd7GM', FALSE),
        ('Bill', '$argon2id$v=19$m=19456,t=2,p=1$MsHNKCYwlFkG71Ney+dn1w$SCCNbClPNCgMuSJoIvi1DmDubF5teR9MdwP86OgslF8', FALSE),
        ('Charlie', '$argon2id$v=19$m=19456,t=2,p=1$SrJEGaQx3vJPehFVJ4sNLw$HemWKXbhLGM1PWjEVvX91MUyxiimtgxYY7O4JxFYi3c', FALSE),
        ('Percy', '$argon2id$v=19$m=19456,t=2,p=1$BLMwPtLSIQfWlglmYajwYA$5IiQvqKq8NYCQQf0WfxqePyZeA8h3lGG7J+0+0GOgW8', FALSE),
        ('Molly', '$argon2id$v=19$m=19456,t=2,p=1$iVUuLdcjPpIbplnPMsAHIQ$W6MRnGxItlnuB+WeTk7dstzpumac8ONg3++rH5x5A/Y', FALSE),
        ('Arthur', '$argon2id$v=19$m=19456,t=2,p=1$VGR60zTqr2PS/9eUUoM3iw$42SaoXGNWJNd3DllQVyyBauFLqxLedrlFTNRKcqH1dg', FALSE),
        ('Seamus', '$argon2id$v=19$m=19456,t=2,p=1$hK/pANX6D8sD4LFVR6lOgQ$VEIuqoCzV6xizSn/fTGWCQJB7CdbGBQlw7hSiGcBzJU', FALSE),
        ('Dean', '$argon2id$v=19$m=19456,t=2,p=1$9tl86P360UjxHGFl/zp1/w$qQub5DwqtwzSJhfl90kWearVzsWwoKOvL3w6aQZ0r9U', FALSE)
    "#,
    )
    .execute(pool)
    .await
    .expect("Failed to insert users");
}
