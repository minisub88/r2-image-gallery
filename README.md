# R2 Image Gallery

Cloudflare Workers + R2 기반의 공개 이미지 미리보기 사이트입니다.

## 구성

- `outside` R2 버킷을 `BUCKET` 바인딩으로 읽습니다.
- 첫 번째 폴더와 두 번째 폴더를 자동 탐색합니다.
- 두 번째 폴더 안의 이미지 파일을 숫자 인식 정렬합니다.
- 이미지 원본은 `https://maneulbbang.org/`에서 불러옵니다.
- R2 객체를 생성, 수정, 삭제하지 않습니다.

## Cloudflare 배포 전 확인

1. Cloudflare 대시보드에서 Workers & Pages로 이동합니다.
2. GitHub 저장소 `minisub88/r2-image-gallery`를 연결합니다.
3. 빌드 설정은 별도의 빌드 명령 없이 Wrangler 설정 파일을 사용하도록 지정합니다.
4. Worker의 R2 binding을 확인합니다.
   - Variable name: `BUCKET`
   - R2 bucket: `outside`
5. 배포 후 Worker에 `gallery.maneulbbang.org` 같은 별도 사용자 지정 도메인을 연결합니다.

`wrangler.jsonc`에는 R2 버킷 바인딩이 선언되어 있습니다. Cloudflare가 GitHub 배포 과정에서 바인딩을 자동으로 반영하지 않는 경우, 대시보드에서 위 설정을 직접 확인해야 합니다.

## 폴더 규칙

예상하는 R2 객체 키 구조:

```text
BR/BG/O1.png
BR/BG/O2.png
BR/BK/O1.png
AR/BG/O1.png
```

버킷 이름 `outside`는 객체 키에 포함하지 않습니다.

## 이미지 확장자

PNG, JPG, JPEG, GIF, WebP, AVIF, BMP를 표시합니다.

## 보안

- GitHub에 API 토큰이나 R2 비밀키를 저장하지 않습니다.
- R2는 Worker binding으로 연결합니다.
- 이 앱은 목록 조회만 수행합니다.
- 사이트는 공개 이미지 목록을 보여주므로, 목록에 나타나는 파일명과 이미지 URL은 공개 정보가 됩니다.
