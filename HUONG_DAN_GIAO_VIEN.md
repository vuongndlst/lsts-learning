# Sử dụng LSTS Learning

Cổng: https://vuongndlst.github.io/lsts-learning/ . Bốn web cũ vẫn hoạt động, chưa tự chuyển tiến độ lớp đang học.

## Mời học sinh bằng link

1. Đăng nhập email trường. Giáo viên dùng mật khẩu tạm cần đổi trước khi vào dashboard.
2. Chọn lớp được phân công hoặc Tạo lớp: tự đặt tên, chọn khóa/năm/phiên bản. Có sẵn 16 lớp: Vương 9, Hân 5, Thịnh 2. ML L1/L2/L3/L4 là bốn lớp cùng Level 1.
3. Chọn **Cài đặt** hoặc **Mời học sinh bằng link**. Nếu còn Chuẩn bị, bấm **Mở nhận học sinh**.
4. Bấm **Sao chép link tham gia**, gửi link cho lớp trên kênh thầy/cô đang dùng. Học sinh bấm link, xem tên lớp, đăng nhập hoặc đăng ký rồi bấm **Tham gia lớp này**; không cần nhập mã.
5. Link dùng lại được khi tải lại trang. Đổi link vô hiệu link cũ; Đóng nhận học sinh ngừng nhận người mới. Thành viên/bài làm đang có được giữ lại.

Mã lớp ở **Mã lớp · phương án dự phòng**. Tạo mã mới thay mã cũ nhưng giữ link. Lớp web độc lập với lớp học thuật; học sinh từ nhiều lớp học thuật có thể vào chung một lớp web.

## Chia sẻ bài và dạy trên lớp

Tab Bài học → **Sao chép link bài** mở thẳng bài trong lớp. Học sinh cần tham gia lớp bằng link mời trước. Đăng nhập một lần, phiên được giữ khi mở bài khác.

Để gửi bài tự học cho cả khách: Khám phá → khóa → bài → Công cụ → Sao chép link bài. Ví dụ ML bài 7: https://vuongndlst.github.io/lsts-learning/#/explore/ml-level1/bai07 . Link theo mã bài mở bản công bố mới nhất. Khách chọn đăng nhập từ bài sẽ quay lại đúng bài sau đăng nhập.

Không cần giao bài, chọn ngày mở bài hoặc phát mã mở chặng. Tất cả bài/chặng/checkpoint cuối mở. Giáo viên nói thời gian làm và yêu cầu dừng để trao đổi. Học sinh vắng tự học bù qua link. Hoàn thành vẫn cần checkpoint và nhiệm vụ bắt buộc.

Mặc định đảo 3D cả bốn khóa. Bài học chuyển sang bài đọc/thực hành; Mục lục thu điều hướng. Công cụ có lưu ngay, tải bản sao, sao chép link và toàn màn hình. Máy không tải được 3D sẽ chuyển sang bài đọc.

Lịch dạy ở Cài đặt là tùy chọn để nhắc ngày/giờ/phòng/nhóm, không khóa nội dung. Có xem trước trước khi lưu.

## Tiến độ và chứng chỉ

Khách nhập họ tên lần đầu, sửa ở Công cụ. Tiến độ/bài làm/lịch sử SQL lưu trên trình duyệt; xóa bộ nhớ sẽ mất dữ liệu này. Tải bản sao trước khi đổi máy. Hoàn thành bài có chứng chỉ bài. Dữ liệu khách không tự nhập vào tài khoản hoặc kết quả lớp.

Học sinh đăng ký MSHS đúng 7 số, giữ số 0 đầu; email MSHS@lsts.edu.vn. Mật khẩu từ 8 ký tự, không xác nhận email. Hồ sơ sửa được, phiên đăng nhập được giữ. Tự học qua link trực tiếp cũng xuất hiện cho giáo viên lớp cùng khóa.

Trang khóa trong Khám phá hiển thị XP/số bài hoàn thành. Hoàn thành toàn bộ lộ trình có **Tải chứng chỉ toàn khóa**. Một mã chứng chỉ theo học sinh/khóa; XP cùng bài không cộng lặp giữa các lớp hoặc lần làm lại. Đây là ghi nhận tự học, không thay điểm chính thức.

Tab Học sinh có cấp mật khẩu tạm sau xác minh và tạm dừng/khôi phục quyền vào lớp. Mật khẩu tạm buộc đổi ở lần đăng nhập sau. Admin quản lý giáo viên/phân công khóa và lớp.

## Cập nhật học liệu

Sửa nội dung/hình/video trong nguồn chính thức của khóa. Slide giảng và nguồn web riêng: sửa PPTX không tự sửa bài web. Không sửa tay block đã công bố hoặc ghi đè phiên bản có tiến độ.

Trong thư mục nội bộ LSTS_Learning: scripts/build_content.cjs đóng gói bốn khóa; scripts/ml_activities.py bổ sung thực hành/notebook ML bản học sinh. Kiểm tra _Private/content-bundle.json, nguồn video và thực hành trước khi phát hành.

Phát hành riêng khóa bằng scripts/provision_portal.py content <phiên bản mới> <course_id>. Số mới lớn hơn bản hiện tại: SQL/Python/C++ ban đầu 1, ML đầy đủ thực hành/notebook 3. Chọn phiên bản trong Cài đặt lớp để cập nhật danh sách bài. Bài làm cũ giữ theo bản cũ; khách xem bản mới nhất và tiến độ khách tách theo phiên bản. Đổi nội dung không cần phát hành lại giao diện.

Không chạy lại build_runtime.py/ml_quest.py chỉ để đổi nội dung: chúng đưa engine gốc vào cổng ở đợt khởi tạo. Khi thay engine, giữ adapter/chế độ học mở/certificate hiện hành, build và thử lại bốn engine. Quy trình bảo trì runtime xem RUNTIME_MAINTENANCE.md trong thư mục nội bộ.

## Lớp đang học và năm sau

Trước khi chuyển lớp từ web cũ, đối chiếu danh sách/tiến độ và thí điểm một buổi. Không tự gán localStorage cũ cho tài khoản khi chưa xác minh danh tính. Giữ URL cũ cho tiết đang diễn ra.

Tạo lớp mới cho năm mới, chọn học liệu phù hợp. Lưu trữ lớp cũ giữ bài làm/xem lại. Học sinh giữ tài khoản và có thể tham gia nhiều khóa qua nhiều năm.

## Cấu hình riêng

Token ở .env của Grade 11 - MOET, khóa db-token. Không đưa giá trị token, _Private, mật khẩu hoặc backup lên GitHub. Mật khẩu tạm giáo viên ở _Private/giao-vien-2026-2027.md, chỉ cung cấp riêng. Không đổi mật khẩu admin khi refactor.

Migration đã áp dụng qua Management API; đối chiếu nhật ký trước db push. Function cổng giữ verify_jwt:true.
